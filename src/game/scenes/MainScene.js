import Phaser from 'phaser'
import { DEFAULT_CITY_GRID_SIZE, createCityGrid, instanceAt, hasRoadFrontage, listRoadEdges } from '@/game/core'
import { colorForCardType, iconForCard } from '@/game/theme'

const EMPTY_FILL = 0x232838
const EMPTY_STROKE = 0x3a4050
const HIGHLIGHT_STROKE = 0xffffff
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
    this.lastCityGrid = createCityGrid()
    this.cellRects = []

    for (let y = 0; y < height; y++) {
      const row = []
      for (let x = 0; x < width; x++) {
        const rect = this.add.rectangle(
          this.startX + x * this.cellSize,
          this.startY + y * this.cellSize,
          this.cellSize - 4,
          this.cellSize - 4,
          EMPTY_FILL
        )
        rect.setStrokeStyle(1, EMPTY_STROKE)
        rect.on('pointerdown', () => this.events.emit('cellClick', { x, y }))

        const label = this.add.text(rect.x, rect.y, '', { fontSize: '20px' }).setOrigin(0.5)

        row.push({ rect, label })
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

    listRoadEdges(cityGrid).forEach(({ kind, x, y }) => {
      this.roadGraphics.beginPath()
      if (kind === 'h') {
        this.roadGraphics.moveTo(this.cellLeft(x), this.cellTop(y))
        this.roadGraphics.lineTo(this.cellLeft(x + 1), this.cellTop(y))
      } else {
        this.roadGraphics.moveTo(this.cellLeft(x), this.cellTop(y))
        this.roadGraphics.lineTo(this.cellLeft(x), this.cellTop(y + 1))
      }
      this.roadGraphics.strokePath()
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
        const { rect, label } = this.cellRects[y][x]
        const instanceId = instanceAt(cityGrid, x, y)
        const instance = instanceId ? instanceMap.get(instanceId) : undefined

        if (instance) {
          rect.setFillStyle(toHexNumber(colorForCardType(instance.card.type)))
          label.setText(iconForCard(instance.card))
        } else {
          rect.setFillStyle(EMPTY_FILL)
          label.setText('')
        }
      }
    }

    this.drawRoads(cityGrid)

    if (this.placementModeActive) this.setPlacementMode(true, { requiresRoadAccess: this.placementRequiresRoadAccess })
  }

  /**
   * @param {boolean} active
   * @param {Object} [options]
   * @param {boolean} [options.requiresRoadAccess] - if true (the default), only empty cells with road frontage are eligible; road cards pass false since they create frontage rather than needing it
   */
  setPlacementMode (active, { requiresRoadAccess = true } = {}) {
    this.placementModeActive = active
    this.placementRequiresRoadAccess = requiresRoadAccess

    for (let y = 0; y < this.lastCityGrid.height; y++) {
      for (let x = 0; x < this.lastCityGrid.width; x++) {
        const { rect } = this.cellRects[y][x]
        const isEmpty = !instanceAt(this.lastCityGrid, x, y)
        const eligible = isEmpty && (!requiresRoadAccess || hasRoadFrontage(this.lastCityGrid, x, y))

        if (active && eligible) {
          rect.setInteractive({ useHandCursor: true })
          rect.setStrokeStyle(3, HIGHLIGHT_STROKE, 0.9)
        } else {
          rect.disableInteractive()
          rect.setStrokeStyle(1, EMPTY_STROKE)
        }
      }
    }
  }
}
