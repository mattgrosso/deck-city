// Plain words for card data (docs/STS-LESSONS.md §3 and §7): the rules text
// printed on a card, the keywords it uses, and the family that colours it.
// Everything is derived from the card object so a new card needs no new
// copy here - and an effect this file doesn't know is printed as its name
// rather than hidden, so a missing sentence is visible, not silent.

import { shapeOf } from '@/game/core/state/shapes'

const TRIGGERS = {
  onBuild: 'When built',
  onTurnStart: 'Each turn',
  onPlay: 'When played',
  onDraw: 'When drawn',
  onComplete: 'When claimed',
  onNeighborBuilt: 'When anything is built next door',
  onClear: 'For each card it takes',
  onCityBuilt: 'Whenever you build anything',
  onAnyClear: 'Whenever a bad card is cleared',
  onTokenPlayed: 'Whenever you play a token',
  onCombine: 'Whenever you combine buildings'
}

const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth']
const a1 = (word) => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`)

/** How a trigger reads once its effects name what they react to (effects/synergy.js). */
function whenText (trigger, effect, card, catalog) {
  const what = effect.ifCard ? (catalog?.[effect.ifCard]?.name ?? effect.ifCard) : effect.ifTag ? tagWord(effect.ifTag, 1, catalog) : null
  switch (trigger) {
    case 'onCityBuilt': return what ? `Whenever you build ${a1(what)}` : 'Whenever you build anything'
    case 'onNeighborBuilt': return what ? `When ${a1(what)} is built next door` : 'When anything is built next door'
    case 'onAnyClear': return what ? `Whenever ${a1(what)} card is cleared` : 'Whenever a bad card is cleared'
    case 'onTokenPlayed': return what ? `Each ${what} you play` : 'Each token you play'
    case 'onNthPlay': return `Every ${ORDINAL[card.every ?? 3] ?? `${card.every}th`} card you play in a turn`
    default: return TRIGGERS[trigger] ?? trigger
  }
}

// Tags that are not card names, in words.
const TAG_WORDS = {
  residential: ['home', 'homes'], commercial: ['shop', 'shops'], industrial: ['factory', 'factories'],
  green: ['green space', 'green spaces'], transit: ['transit stop', 'transit stops'], landmark: ['landmark', 'landmarks'],
  education: ['school', 'schools'], culture: ['cultural building', 'cultural buildings'], leisure: ['venue', 'venues'],
  health: ['health building', 'health buildings'], rural: ['farm', 'farms'], arts: ['arts building', 'arts buildings'],
  luxury: ['luxury building', 'luxury buildings'], utility: ['utility', 'utilities'], safety: ['safety building', 'safety buildings'],
  food: ['food business', 'food businesses'], tourism: ['attraction', 'attractions'], office: ['office', 'offices'],
  dense: ['dense block', 'dense blocks'], finance: ['bank', 'banks'], service: ['service', 'services'],
  infrastructure: ['road', 'roads'],
  crime: ['Crime', 'Crime'], trash: ['Trash', 'Trash'], pollution: ['Pollution', 'Pollution'], debt: ['Debt', 'Debt']
}
const tagWord = (tag, n = 1, catalog = {}) => TAG_WORDS[tag]?.[n === 1 ? 0 : 1] ?? catalog[tag]?.name ?? tag

export const FAMILIES = {
  road: { label: 'Road', color: '#7d8597', soft: '#e7eaf0', ink: '#111' },
  green: { label: 'Green', color: '#2f9a55', soft: '#d9f0e0', ink: '#06261a' },
  transit: { label: 'Transit', color: '#5b6b8c', soft: '#e2e7f1', ink: '#111' },
  leisure: { label: 'Leisure & Culture', color: '#d6478f', soft: '#fbe0ee', ink: '#330a1f' },
  landmark: { label: 'Landmark', color: '#c2871a', soft: '#f8ebcf', ink: '#2e2000' },
  token: { label: 'Token', color: '#0ea5b7', soft: '#d8f3f6', ink: '#042a33' },
  residential: { label: 'Residential', color: '#2fb36a', soft: '#dcf3e5', ink: '#06261a' },
  commercial: { label: 'Commercial', color: '#3b82f6', soft: '#dde9fd', ink: '#06182e' },
  industrial: { label: 'Industrial', color: '#f08a24', soft: '#fde8d3', ink: '#2e1a00' },
  facility: { label: 'Service', color: '#8b5cf6', soft: '#e9e0fd', ink: '#1b0a33' },
  civic: { label: 'Civic', color: '#0ea5b7', soft: '#d8f3f6', ink: '#042a33' },
  status: { label: 'Status', color: '#e0434b', soft: '#f9d9db', ink: '#fff' },
  goal: { label: 'Goal', color: '#d99a1a', soft: '#fbeccb', ink: '#2e2000' },
  monument: { label: 'Monument', color: '#d99a1a', soft: '#fbeccb', ink: '#2e2000' },
  disaster: { label: 'Disaster', color: '#9b2d4a', soft: '#f1d5dd', ink: '#fff' }
}

/** Which family a card belongs to, for colour and the type banner. */
export function familyOf (card) {
  if (!card) return 'civic'
  if (card.type === 'status') return 'status'
  if (card.type === 'disaster') return 'disaster'
  if (card.type === 'goal') return 'goal'
  if (card.token) return 'token'
  if (card.family) return card.family // a combined card takes the family it leans to
  if (card.type === 'civic') return 'civic'
  if (card.placesRoad) return 'road'
  const tags = card.tags ?? []
  if (tags.includes('landmark') && !tags.includes('residential') && !tags.includes('commercial')) return 'landmark'
  for (const tag of ['residential', 'commercial', 'industrial', 'transit']) if (tags.includes(tag)) return tag
  if (tags.includes('green') || tags.includes('park')) return 'green'
  if (tags.includes('leisure') || tags.includes('culture') || tags.includes('tourism')) return 'leisure'
  return 'facility'
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const nameOf = (id, catalog) => catalog?.[id]?.name ?? id

/** One sentence for an effect descriptor. */
export function effectText (effect, catalog) {
  const amount = effect.amount ?? 1
  switch (effect.type) {
    case 'gainTreasury': return `+${amount} budget`
    case 'spendTreasury': return `lose ${amount} budget`
    case 'gainStatus': return `+${plural(amount, `${nameOf(effect.card, catalog)} card`)}`
    case 'consumeStatus':
      return effect.requiresSlot
        ? `remove ${nameOf(effect.card, catalog)} from your deck, one per space left`
        : `remove ${plural(amount, nameOf(effect.card, catalog))} from your deck`
    case 'gainStatusPerAdjacent': return `add 1 ${nameOf(effect.card, catalog)} per neighbouring ${tagWord(effect.targetTag, 1, catalog)}`
    case 'drawCards': return `draw ${plural(amount, 'card')}`
    case 'gainTreasuryPerAdjacent': return `+${amount} budget per neighbouring ${tagWord(effect.targetTag, 1, catalog)}`
    case 'gainTreasuryPerCount': return (effect.per ?? 1) > 1 ? `+${amount} budget per ${effect.per} ${tagWord(effect.tag, 2, catalog)} in the city` : `+${amount} budget per ${tagWord(effect.tag, 1, catalog)} in the city`
    case 'gainTreasuryPerStatus': return `+${amount} budget per ${tagWord(effect.tag, 1, catalog)} card in your deck (up to ${effect.max ?? 3})`
    case 'clearAnyStatus': return `remove ${plural(amount, effect.disasters ? 'bad or disaster card' : 'bad card')} from your deck`
    case 'gainCard': return `add ${amount === 1 ? 'a' : amount} ${catalog[effect.card]?.name ?? effect.card} card${amount === 1 ? '' : 's'} to your deck${effect.max ? ` (up to ${effect.max})` : ''}`
    case 'offerPolicy': return 'adopt a policy (choose one of three)'
    case 'growSelf': return `this grows +${amount} ${effect.stat} for good${effect.max ? ` (up to +${effect.max})` : ''}`
    case 'growNeighbors': return `every ${effect.tag ? tagWord(effect.tag, 1, catalog) : 'building'} next door grows +${amount} ${effect.stat} for good`
    case 'gainCardPerAdjacent': return `add a ${catalog[effect.card]?.name ?? effect.card} card per neighbouring ${tagWord(effect.targetTag, 1, catalog)}${effect.max ? ` (up to ${effect.max})` : ''}`
    case 'gainBuys': return `+${amount} buy at the city row this turn`
    case 'gainPatience': return `+${amount} patience`
    case 'discardCards': return 'discard 2 cards'
    case 'expandSlots': return `+${amount} slot`
    case 'headOffDisaster': return 'the disaster clock stops for good'
    case 'raiseTreasuryRolloverCap': return `keep up to ${amount} unspent budget between turns`
    default: return effect.type
  }
}

/** One phrase for a goal condition. */
export function conditionText (condition, catalog) {
  if (!condition) return ''
  switch (condition.type) {
    case 'populationAtLeast': return `population ${condition.amount} or more`
    case 'treasuryAtLeast': return `${condition.amount} budget unspent at once`
    case 'buildingCountAtLeast': return `${plural(condition.amount, nameOf(condition.cardId, catalog))} built`
    case 'tagCountAtLeast': return `${condition.amount} ${tagWord(condition.tag, condition.amount, catalog)} built`
    case 'statusCountAtMost':
      return condition.amount === 0
        ? `no ${nameOf(condition.tag, catalog)} in your deck`
        : `${condition.amount} or fewer ${nameOf(condition.tag, catalog)} in your deck`
    case 'jobsAtLeast': return `${condition.amount} jobs or more`
    case 'revenueAtLeast': return `${condition.amount} revenue a turn or more`
    case 'employed': return 'a job for everyone'
    case 'statusTotalAtMost': return condition.amount === 0 ? 'no bad cards in your deck' : `${condition.amount} or fewer bad cards in your deck`
    case 'adjacentPair': return `a ${nameOf(condition.tagA, catalog)} next to a ${nameOf(condition.tagB, catalog)}`
    case 'adjacentChain': return `${condition.length} ${nameOf(condition.tag, catalog)} in a row`
    case 'all': return condition.conditions.map(c => conditionText(c, catalog)).join(' and ')
    case 'any': return condition.conditions.map(c => conditionText(c, catalog)).join(' or ')
    default: return condition.type
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The lines printed on a card, in reading order: what it gives, what it
 * needs, what it does and when.
 * @returns {string[]}
 */
export function rulesFor (card, catalog = {}) {
  const lines = []
  if (!card) return lines

  if (card.placesRoad) lines.push(`Lays up to ${card.roadSegments ?? 2} street segments${card.lanes > 1 ? `, ${card.lanes} lanes wide` : ''}, joined to a street you have. Buildings need a street on one side.`)
  if (card.id === 'road') lines.push('Two combine into a Boulevard.')
  if (card.id === 'boulevard') lines.push('Two combine into a Highway.')
  if (card.exhaust && card.placesRoad) lines.push('One use: gone once laid.')

  if (card.madeFrom) lines.push(`${card.madeFrom.join(' + ')}, combined.`)
  const plots = shapeOf(card).length
  if (plots > 1) lines.push(`Covers ${plots} plots${card.shape === 'L3' ? ' in an L' : card.shape === 'O4' ? ', 2 by 2' : ''}.`)

  const stats = Object.entries(card.stats ?? {}).filter(([, v]) => v)
  if (stats.length) lines.push(stats.map(([k, v]) => `+${v} ${k}`).join(', '))

  if (card.clears) {
    const kinds = (Array.isArray(card.clears) ? card.clears : [card.clears]).map(k => tagWord(k, 1, catalog)).join(' or ')
    lines.push(`Play a ${kinds} card from your hand into it and it's gone for good. Holds ${card.slots?.capacity ?? 1}, then it's full.`)
  } else if (card.slots) lines.push(`${plural(card.slots.capacity, 'slot')}${card.slots.expandable ? ', expandable' : ''}`)
  if (card.blocksDisasters) lines.push(`While it stands, blocks ${Number(card.blocksDisasters) === 1 ? 'one disaster card' : `${Number(card.blocksDisasters)} disaster cards`} every strike.`)

  const sign = (b) => `${b.amount > 0 ? '+' : '−'}${Math.abs(b.amount)} ${b.stat}`
  const near = (card.adjacency?.statBonus ?? []).filter(b => b.scope !== 'city' && b.scope !== 'deck').map(b => `${sign(b)} per ${nameOf(b.targetTag, catalog)}`)
  if (near.length) lines.push(`Next door: ${near.join(', ')}.`)
  for (const b of (card.adjacency?.statBonus ?? []).filter(b => b.scope === 'deck')) {
    lines.push(`${sign(b)} for each ${catalog?.[b.targetTag]?.name ?? tagWord(b.targetTag, 1, catalog)} card in your deck${b.max ? ` (up to ${b.max})` : ''}.`)
  }
  for (const b of (card.adjacency?.statBonus ?? []).filter(b => b.scope === 'city')) {
    lines.push(`${sign(b)} for every ${tagWord(b.targetTag, 1, catalog)} in the city${b.max ? ` (up to ${b.max})` : ''}.`)
  }
  if (card.patience) lines.push(card.patience > 0 ? `+${card.patience} patience every turn.` : `−${-card.patience} patience every turn.`)
  if (card.handSizeBonus) lines.push(`Draw ${plural(card.handSizeBonus, 'extra card')} every turn.`)
  if (card.buysBonus) lines.push(`+${card.buysBonus} buy every turn.`)
  for (const d of (Array.isArray(card.discount) ? card.discount : (card.discount ? [card.discount] : []))) lines.push(`${tagWord(d.tag, 2, catalog).replace(/^./, c => c.toUpperCase())} cost ${d.amount} less to build.`)

  if (card.type === 'goal' && card.condition) lines.push(`Needs ${conditionText(card.condition, catalog)}.`)
  if (card.type === 'goal') lines.push('Single use: once built, the card is gone.')

  for (const [trigger, effects] of Object.entries(card.effects ?? {})) {
    // Effects that react to different things read as separate lines.
    const groups = new Map()
    for (const e of effects) { const k = e.ifCard ?? e.ifTag ?? ''; groups.set(k, [...(groups.get(k) ?? []), e]) }
    for (const list of groups.values()) lines.push(`${whenText(trigger, list[0], card, catalog)}: ${list.map(e => effectText(e, catalog)).join(', ')}.`)
  }
  if (card.freeFirst) lines.push(`The first ${tagWord(card.freeFirst, 1, catalog)} you build each turn costs 0.`)

  if (card.unique) lines.push('Only one in the city.')
  if (card.exhaust) lines.push('Play it once, free; then it is gone.')
  if (card.type === 'status') lines.push(`Dead weight in your hand. Play it into a ${{ crime: 'Police Station', trash: 'Sanitation Center', pollution: 'Clinic', debt: 'Bank Branch or Courthouse' }[card.id] ?? 'facility'} that has room to be rid of it.`)
  return lines.map(cap)
}

export const KEYWORDS = {
  buy: 'One purchase at the city row a turn. Some cards give you more.',
  patience: 'Public Patience is the era\'s clock. It drains every turn, faster when the city is in trouble; at zero the election judges your mandate.',
  token: 'Tourists, Commuters, Volunteers and Investors are made by buildings and civic cards. Play one free; it is gone afterwards.',
  debt: 'A dead card from borrowing. A Bank Branch or Courthouse takes it.',
  unique: 'Landmarks marked “only one” can stand once in a city.',
  budget: 'Your budget each turn is the revenue of every building you have. Unspent budget is lost unless a card says otherwise.',
  road: 'A building can only go on a plot that touches a street. A Road card lays up to two segments, each joined to a street you already have.',
  slot: 'Play a bad card from your hand into a facility with room and it leaves the game. Each facility holds a set number, then it\'s full: play the same facility again to add room.',
  status: 'Crime, Trash and Pollution are dead cards. Play one into the right facility to be rid of it; otherwise it just clogs your hand.',
  monument: 'A claimed goal. Costs nothing to build, needs a street like anything else, and gives +1 population and +1 revenue.',
  disaster: 'Every fourth turn a strike shuffles disaster cards into your deck, one more each time (up to three), starting over each era. Each Fire Station blocks one. A disaster bites once when drawn, then it is gone.',
  population: 'The win condition. Reach the target and the city is finished.',
  neighbours: 'A building counts its four neighbours (not diagonals). Each “next door” line adds or takes away for every matching neighbour, never below zero.',
  revenue: 'Next turn\'s budget: the revenue of every building in the city.'
}

/** The keywords a card's text touches, as [word, definition] pairs. */
export function keywordsFor (card, catalog = {}) {
  const text = [card?.name ?? '', ...rulesFor(card, catalog)].join(' ').toLowerCase()
  const hits = []
  const want = (key, ...needles) => {
    if (needles.some(n => text.includes(n))) hits.push([key, KEYWORDS[key]])
  }
  want('buy', 'buy at the city row')
  want('patience', 'patience')
  want('token', 'tourist', 'commuter', 'volunteer', 'investor')
  want('debt', 'debt')
  want('budget', 'budget')
  want('road', 'road')
  want('slot', 'slot', 'then it\'s full', 'space left')
  want('status', 'crime', 'trash', 'pollution')
  want('monument', 'monument')
  want('disaster', 'disaster')
  want('neighbours', 'next door')
  want('population', 'population')
  want('revenue', 'revenue')
  return hits
}
