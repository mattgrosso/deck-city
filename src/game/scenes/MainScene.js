import Phaser from 'phaser'

export default class MainScene extends Phaser.Scene {
  constructor () {
    super('MainScene')
  }

  create () {
    this.add.text(this.scale.width / 2, this.scale.height / 2 - 20, 'Deck City', {
      fontFamily: 'sans-serif',
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5)

    this.add.text(this.scale.width / 2, this.scale.height / 2 + 40, 'a deck-building city builder', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#9aa4b2'
    }).setOrigin(0.5)
  }
}
