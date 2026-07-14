import Phaser from 'phaser'

export default class MainScene extends Phaser.Scene {
  constructor () {
    super('MainScene')
  }

  create () {
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'Deck City', {
      fontFamily: 'sans-serif',
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5)
  }
}
