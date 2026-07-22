import Phaser from 'phaser'
import { DEFAULT_CITY_GRID_SIZE, createCityGrid, instanceAt, hasRoadFrontage, listRoadEdges } from '@/game/core'
import { colorForCardType, iconForCard } from '@/game/theme'

const EMPTY_FILL = 0x232838
const EMPTY_FILL_ALT = 0x262c3d // subtly alternates with EMPTY_FILL, checkerboard-style, so the grid reads as a grid rather than a flat void
const EMPTY_STROKE = 0x3a4050
const HIGHLIGHT_STROKE = 0xffffff
const MONUMENT_STROKE = 0xc9a227
const SHADOW_COLOR = 0x0a0c12
const HIGHLIGHT_SHEEN = 0xffffff
const ROAD_COLOR = 0xf2c744
const ROAD_WIDTH = 6
const MARGIN = 40

function toHexNumber (cssColor) {
  return parseInt(cssColor.replace('#', ''), 16)
}

export default class MainScene extends Phaser.Scene {
  constructor () {
    super('MainScene')
  }

  create () {
    const { width, height } = DEFAULT_CITY_GRID_SIZE
    const areaWidth = this.scale.width - MARGIN * 2
    const areaHeight = this.scale.height - MARGIN * 2
    this.cellSize = Math.floor(Math.min(areaWidth / width, areaHeight / height))
    this.startX = (this.scale.width - this.cellSize * width) / 2 + this.cellSize / 2
    this.startY = (this.scale.height - this.cellSize * height) / 2 + this.cellSize / 2

    this.placementModeActive = false
    this.placementRequiresRoadAccess = true
    this.placementTween = undefined
    this.lastCityGrid = createCityGrid()
    this.cellRects = []

    for (let y = 0; y < height; y++) {
      const row = []
      for (let x = 0; x < width; x++) {
        const cx = this.startX + x * this.cellSize
        const cy = this.startY + y * this.cellSize
        const cellFill = (x + y) % 2 === 0 ? EMPTY_FILL : EMPTY_FILL_ALT

        // A soft drop-shadow rectangle sits behind the cell, offset a few
        // px down-right - the cheapest way to fake elevation with plain
        // Rectangle GameObjects (no sprite/art pipeline to draw real
        // shading with).
        this.add.rectangle(cx + 3, cy + 3, this.cellSize - 4, this.cellSize - 4, SHADOW_COLOR, 0.35)

        const rect = this.add.rectangle(cx, cy, this.cellSize - 4, this.cellSize - 4, cellFill)
        rect.setStrokeStyle(1, EMPTY_STROKE)
        rect.on('pointerdown', () => this.events.emit('cellClick', { x, y }))

        // A thin inset highlight, low-alpha, on top of the fill - a subtle
        // sheen rather than a flat block of color.
        const sheen = this.add.rectangle(cx, cy - this.cellSize / 2 + 6, this.cellSize - 14, 2, HIGHLIGHT_SHEEN, 0.08)

        const icon = this.add.text(cx, cy - 6, '', { fontSize: '20px' }).setOrigin(0.5)
        const statBadge = this.add.text(cx, cy + this.cellSize / 2 - 14, '', {
          fontSize: '10px', color: '#c9d1e0'
        }).setOrigin(0.5)

        row.push({ rect, sheen, icon, statBadge })
      }
      this.cellRects.push(row)
    }

    this.roadGraphics = this.add.graphics()

    this.game.events.emit('mainSceneReady', this)
  }

  cellLeft (x) {
    return this.startX + x * this.cellSize - this.cellSize / 2
  }

  cellTop (y) {
    return this.startY + y * this.cellSize - this.cellSize / 2
  }

  drawRoads (cityGrid) {
    this.roadGraphics.clear()
    this.roadGraphics.lineStyle(ROAD_WIDTH, ROAD_COLOR, 1)

    const edges = listRoadEdges(cityGrid)
    const jointPoints = new Set()

    edges.forEach(({ kind, x, y }) => {
      this.roadGraphics.beginPath()
      let x1, y1, x2, y2
      if (kind === 'h') {
        x1 = this.cellLeft(x); y1 = this.cellTop(y)
        x2 = this.cellLeft(x + 1); y2 = this.cellTop(y)
      } else {
        x1 = this.cellLeft(x); y1 = this.cellTop(y)
        x2 = this.cellLeft(x); y2 = this.cellTop(y + 1)
      }
      this.roadGraphics.moveTo(x1, y1)
      this.roadGraphics.lineTo(x2, y2)
      this.roadGraphics.strokePath()
      jointPoints.add(`${x1},${y1}`)
      jointPoints.add(`${x2},${y2}`)
    })

    // Plain strokePath segments leave visibly squared-off joints where two
    // road edges meet at a corner - a small filled circle at each shared
    // endpoint reads as a continuous, rounded road instead of a stack of
    // separate line pieces.
    this.roadGraphics.fillStyle(ROAD_COLOR, 1)
    jointPoints.forEach(point => {
      const [px, py] = point.split(',').map(Number)
      this.roadGraphics.fillCircle(px, py, ROAD_WIDTH / 2)
    })
  }

  /**
   * @param {Object} cityGrid
   * @param {Object[]} builtStructures
   */
  renderCity (cityGrid, builtStructures = []) {
    this.lastCityGrid = cityGrid
    const instanceMap = new Map(builtStructures.map(instance => [instance.instanceId, instance]))

    for (let y = 0; y < cityGrid.height; y++) {
      for (let x = 0; x < cityGrid.width; x++) {
        const { rect, icon, statBadge } = this.cellRects[y][x]
        const instanceId = instanceAt(cityGrid, x, y)
        const instance = instanceId ? instanceMap.get(instanceId) : undefined

        if (instance) {
          rect.setFillStyle(toHexNumber(colorForCardType(instance.card.type)))
          icon.setText(iconForCard(instance.card))
          statBadge.setText(this.statBadgeText(instance))

          const isMonument = instance.card.tags?.includes('monument')
          rect.setStrokeStyle(isMonument ? 3 : 1, isMonument ? MONUMENT_STROKE : EMPTY_STROKE)
        } else {
          rect.setFillStyle((x + y) % 2 === 0 ? EMPTY_FILL : EMPTY_FILL_ALT)
          rect.setStrokeStyle(1, EMPTY_STROKE)
          icon.setText('')
          statBadge.setText('')
        }
      }
    }

    this.drawRoads(cityGrid)

    if (this.placementModeActive) this.setPlacementMode(true, { requiresRoadAccess: this.placementRequiresRoadAccess })
  }

  /**
   * A compact "+N pop, +N rev" readout under a built structure's icon, and
   * "used/capacity" for anything with consumption slots (Police Station,
   * Sanitation Center, Clinic) - the grid itself becomes a source of
   * at-a-glance information instead of just colored tiles.
   * @param {Object} instance
   */
  statBadgeText (instance) {
    const parts = []
    const { population, revenue, jobs } = instance.card.stats ?? {}
    if (population) parts.push(`+${population}pop`)
    if (jobs) parts.push(`+${jobs}job`)
    if (revenue) parts.push(`+${revenue}$`)
    if (instance.slots) parts.push(`${instance.slots.used}/${instance.slots.capacity}`)
    return parts.join(' ')
  }

  /**
   * @param {boolean} active
   * @param {Object} [options]
   * @param {boolean} [options.requiresRoadAccess] - if true (the default), only empty cells with road frontage are eligible; road cards pass false since they create frontage rather than needing it
   */
  setPlacementMode (active, { requiresRoadAccess = true } = {}) {
    this.placementModeActive = active
    this.placementRequiresRoadAccess = requiresRoadAccess
    this.placementTween?.stop()

    const eligibleRects = []

    for (let y = 0; y < this.lastCityGrid.height; y++) {
      for (let x = 0; x < this.lastCityGrid.width; x++) {
        const { rect } = this.cellRects[y][x]
        const isEmpty = !instanceAt(this.lastCityGrid, x, y)
        const eligible = isEmpty && (!requiresRoadAccess || hasRoadFrontage(this.lastCityGrid, x, y))

        if (active && eligible) {
          rect.setInteractive({ useHandCursor: true })
          rect.setStrokeStyle(3, HIGHLIGHT_STROKE, 0.9)
          eligibleRects.push(rect)
        } else {
          rect.disableInteractive()
          rect.setStrokeStyle(1, EMPTY_STROKE)
        }
      }
    }

    // A gentle pulse on every eligible cell's outline while placement mode
    // is active - "click here" without a static, easy-to-miss border.
    if (active && eligibleRects.length && this.tweens) {
      const glow = { alpha: 0.5 }
      this.placementTween = this.tweens.add({
        targets: glow,
        alpha: { from: 0.5, to: 1 },
        duration: 650,
        yoyo: true,
        repeat: -1,
        onUpdate: () => eligibleRects.forEach(rect => rect.setStrokeStyle(3, HIGHLIGHT_STROKE, glow.alpha))
      })
    }
  }
}
