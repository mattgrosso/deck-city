// Shared presentation constants for anything that renders a card or a
// built structure — both CardView.vue (DOM) and MainScene.js (Phaser)
// import from here so colors/icons are defined once, not duplicated
// across the two renderers.

export const CARD_TYPE_COLORS = Object.freeze({
  building: '#3a6ea5',
  status: '#a54a3a',
  goal: '#c9a227',
  disaster: '#6a2a6a'
})

export const DEFAULT_CARD_TYPE_COLOR = '#4a5568'

export const TAG_ICONS = Object.freeze({
  residential: '🏠',
  infrastructure: '🛣️',
  consumer: '⚕️',
  negative: '⚠️',
  crime: '🚔'
})

export const DEFAULT_TAG_ICON = '🃏'

export function colorForCardType (type) {
  return CARD_TYPE_COLORS[type] ?? DEFAULT_CARD_TYPE_COLOR
}

export function iconForCard (card) {
  const tag = card.tags?.find(candidate => candidate in TAG_ICONS)
  return tag ? TAG_ICONS[tag] : DEFAULT_TAG_ICON
}
