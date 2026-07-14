import Phaser from 'phaser'
import { DEFAULT_CITY_GRID_SIZE, createCityGrid, instanceAt } from '@/game/core'
import { colorForCardType, iconForCard } from '@/game/theme'

const EMPTY_FILL = 0x232838
const EMPTY_STROKE = 0x3a4050
const HIGHLIGHT_STROKE = 0xffffff
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
    const cellSize = Math.floor(Math.min(areaWidth / width, areaHeight / height))
    const startX = (this.scale.width - cellSize * width) / 2 + cellSize / 2
    const startY = (this.scale.height - cellSize * height) / 2 + cellSize / 2

    this.placementModeActive = false
    this.lastCityGrid = createCityGrid()
    this.cellRects = []

    for (let y = 0; y < height; y++) {
      const row = []
      for (let x = 0; x < width; x++) {
        const rect = this.add.rectangle(
          startX + x * cellSize,
          startY + y * cellSize,
          cellSize - 4,
          cellSize - 4,
          EMPTY_FILL
        )
        rect.setStrokeStyle(1, EMPTY_STROKE)
        rect.on('pointerdown', () => this.events.emit('cellClick', { x, y }))

        const label = this.add.text(rect.x, rect.y, '', { fontSize: '20px' }).setOrigin(0.5)

        row.push({ rect, label })
      }
      this.cellRects.push(row)
    }

    this.game.events.emit('mainSceneReady', this)
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

    if (this.placementModeActive) this.setPlacementMode(true)
  }

  /** @param {boolean} active */
  setPlacementMode (active) {
    this.placementModeActive = active

    for (let y = 0; y < this.lastCityGrid.height; y++) {
      for (let x = 0; x < this.lastCityGrid.width; x++) {
        const { rect } = this.cellRects[y][x]
        const isEmpty = !instanceAt(this.lastCityGrid, x, y)

        if (active && isEmpty) {
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
