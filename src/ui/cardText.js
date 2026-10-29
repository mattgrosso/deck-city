// Plain words for card data (docs/STS-LESSONS.md §3 and §7): the rules text
// printed on a card, the keywords it uses, and the family that colours it.
// Everything is derived from the card object so a new card needs no new
// copy here - and an effect this file doesn't know is printed as its name
// rather than hidden, so a missing sentence is visible, not silent.

const TRIGGERS = {
  onBuild: 'When built',
  onTurnStart: 'Each turn',
  onPlay: 'When played',
  onDraw: 'When drawn',
  onComplete: 'When claimed'
}

export const FAMILIES = {
  road: { label: 'Road', color: '#7d8597', soft: '#e7eaf0', ink: '#111' },
  residential: { label: 'Residential', color: '#2fb36a', soft: '#dcf3e5', ink: '#06261a' },
  commercial: { label: 'Commercial', color: '#3b82f6', soft: '#dde9fd', ink: '#06182e' },
  industrial: { label: 'Industrial', color: '#f08a24', soft: '#fde8d3', ink: '#2e1a00' },
  facility: { label: 'Facility', color: '#8b5cf6', soft: '#e9e0fd', ink: '#1b0a33' },
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
  if (card.type === 'civic') return 'civic'
  if (card.placesRoad) return 'road'
  const tags = card.tags ?? []
  for (const tag of ['residential', 'commercial', 'industrial']) if (tags.includes(tag)) return tag
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
    case 'gainStatus': return `add ${plural(amount, nameOf(effect.card, catalog))} to your deck`
    case 'consumeStatus':
      return effect.requiresSlot
        ? `remove ${nameOf(effect.card, catalog)} from your deck, one per free slot`
        : `remove ${plural(amount, nameOf(effect.card, catalog))} from your deck`
    case 'gainStatusPerAdjacent': return `add 1 ${nameOf(effect.card, catalog)} per neighbouring ${nameOf(effect.targetTag, catalog)}`
    case 'drawCards': return `draw ${plural(amount, 'card')}`
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
    case 'statusCountAtMost':
      return condition.amount === 0
        ? `no ${nameOf(condition.tag, catalog)} in your deck`
        : `${condition.amount} or fewer ${nameOf(condition.tag, catalog)} in your deck`
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

  if (card.placesRoad) lines.push('Lays one street between two plots. A building needs a street on one side.')

  const stats = Object.entries(card.stats ?? {}).filter(([, v]) => v)
  if (stats.length) lines.push(stats.map(([k, v]) => `+${v} ${k}`).join(', '))

  if (card.slots) lines.push(`${plural(card.slots.capacity, 'slot')}${card.slots.expandable ? ', expandable' : ''}`)

  for (const bonus of card.adjacency?.statBonus ?? []) {
    lines.push(`+${bonus.amount} ${bonus.stat} to each neighbouring ${nameOf(bonus.targetTag, catalog)}`)
  }

  if (card.type === 'goal' && card.condition) lines.push(`Needs ${conditionText(card.condition, catalog)}.`)

  for (const [trigger, effects] of Object.entries(card.effects ?? {})) {
    const when = TRIGGERS[trigger] ?? trigger
    const what = effects.map(e => effectText(e, catalog)).join(', ')
    lines.push(`${when}: ${what}.`)
  }

  if (card.type === 'status') lines.push('Does nothing. Takes up room in your hand.')
  return lines.map(cap)
}

export const KEYWORDS = {
  budget: 'Budget resets every turn to what your city earns. Unspent budget is lost unless a card says otherwise.',
  road: 'A building can only go on a plot that touches a street. A Road card lays one street segment between two plots.',
  slot: 'A facility removes one status card per free slot each turn. Slots refill every turn.',
  status: 'Crime, Trash and Pollution are dead cards. They sit in your hand and do nothing until a facility removes them.',
  monument: 'A claimed goal. Costs nothing, needs no road, and gives +1 population and +1 revenue.',
  disaster: 'When the clock runs out a disaster card is shuffled into your deck. It hurts when you draw it.',
  population: 'The win condition. Reach the target and the city is finished.',
  revenue: 'Next turn\'s budget: the revenue of every building, plus the city\'s base income.'
}

/** The keywords a card's text touches, as [word, definition] pairs. */
export function keywordsFor (card, catalog = {}) {
  const text = [card?.name ?? '', ...rulesFor(card, catalog)].join(' ').toLowerCase()
  const hits = []
  const want = (key, ...needles) => {
    if (needles.some(n => text.includes(n))) hits.push([key, KEYWORDS[key]])
  }
  want('budget', 'budget')
  want('road', 'road')
  want('slot', 'slot')
  want('status', 'crime', 'trash', 'pollution')
  want('monument', 'monument')
  want('disaster', 'disaster')
  want('population', 'population')
  want('revenue', 'revenue')
  return hits
}
