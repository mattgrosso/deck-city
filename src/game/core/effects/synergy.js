// SYNERGY (Matt, 2026-10-30, after his first one-era playtest: "the
// interactions between the buildings are not obvious... they all kind of do
// the same things... I want there to be fun effects, think Slay the Spire...
// it stacked with other things and there are various strategies").
//
// The vocabulary that lets a card react to the rest of the run, all data:
//
//   effects.onCityBuilt: [...]    whenever you build something anywhere
//   effects.onNeighborBuilt       (already) when something goes up next door
//   effects.onAnyClear: [...]     whenever a bad card is cleared, by anything
//   effects.onTokenPlayed: [...]  whenever you play a token (a Tourist...)
//   effects.onNthPlay + every: N  on every Nth card you play in a turn
//   effects.onCombine: [...]      whenever you combine two buildings
//     Any of these effects may carry `ifTag` (the thing built / cleared /
//     played must have that tag or id) or `ifCard` (that card id).
//
//   growSelf { stat, amount, max }    this building keeps +amount of stat for good
//   growNeighbors { tag, stat, amount } each neighbour with the tag grows
//   card.freeFirst: tag               the first building with that tag you build
//                                     each turn costs 0
//   rule scope 'deck' (instanceStats) +n stat for each card of a kind in your deck
//
// state.turn = { played, built: { tag: n } } is reset when a turn is dealt.

import { registerEffect, resolveEffects } from './effectRegistry'

const findInstance = (state, id) => state.builtStructures.find(i => i.instanceId === id)

/** Does an effect's filter (`ifTag`, `ifCard`) accept this subject card? */
export function accepts (effect, subject) {
  if (effect.ifCard && subject?.id !== effect.ifCard) return false
  if (effect.ifTag && subject?.id !== effect.ifTag && !(subject?.tags ?? []).includes(effect.ifTag)) return false
  return true
}

/**
 * Every standing building with `trigger` reacts to `subject` (the card
 * built, cleared or played), each effect only if its filter accepts it.
 * `except` skips one instance (a building doesn't watch itself go up).
 */
export function fireWatchers (ctx, trigger, subject, { except = null, when = null } = {}) {
  const state = ctx.state
  for (const inst of [...state.builtStructures]) {
    const list = inst.card.effects?.[trigger]
    if (!list || inst.instanceId === except) continue
    if (when && !when(inst)) continue
    const fire = list.filter(e => accepts(e, subject))
    if (fire.length) resolveEffects(fire, { ...ctx, state, card: inst.card, instanceId: inst.instanceId, subject })
  }
}

/** A new turn: nothing played or built yet. */
export function beginTurn (state) {
  state.turn = { played: 0, built: {} }
}

/**
 * A card was played (a building placed, a civic or a token used): count it,
 * then the Nth-card watchers and, for a token, the token watchers.
 */
export function notePlay (ctx, card) {
  const state = ctx.state
  state.turn ??= { played: 0, built: {} }
  state.turn.played += 1
  if (card.type === 'building' && !card.placesRoad) for (const t of card.tags ?? []) state.turn.built[t] = (state.turn.built[t] ?? 0) + 1
  const n = state.turn.played
  fireWatchers(ctx, 'onNthPlay', card, { when: (inst) => n % (inst.card.every ?? 3) === 0 })
  if (card.token) fireWatchers(ctx, 'onTokenPlayed', card)
}

/** Is a building with one of these tags the first of its kind this turn (for `freeFirst`)? */
export function firstOfTurn (state, tag) {
  return !(state.turn?.built?.[tag] > 0)
}

registerEffect('growSelf', (effect, { state, instanceId, log, card }) => {
  const inst = findInstance(state, instanceId)
  if (!inst) return
  inst.growth ??= {}
  const was = inst.growth[effect.stat] ?? 0
  const now = Math.min(effect.max ?? Infinity, was + (effect.amount ?? 1))
  if (now === was) return
  inst.growth[effect.stat] = now
  log?.push(`${card?.name ?? 'A building'} grows: +${now - was} ${effect.stat} for good.`)
})

registerEffect('growNeighbors', (effect, { state, instanceId, log }) => {
  const inst = findInstance(state, instanceId)
  if (!inst) return
  const cells = inst.cells ?? (inst.position ? [inst.position] : [])
  const ids = new Set()
  for (const { x, y } of cells) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const xx = x + dx; const yy = y + dy
      if (xx < 0 || yy < 0 || xx >= state.cityGrid.width || yy >= state.cityGrid.height) continue
      const id = state.cityGrid.cells[yy * state.cityGrid.width + xx]
      if (id && id !== instanceId) ids.add(id)
    }
  }
  let grew = 0
  for (const id of ids) {
    const n = findInstance(state, id)
    if (!n || (effect.tag && !(n.card.tags ?? []).includes(effect.tag))) continue
    n.growth ??= {}
    n.growth[effect.stat] = Math.min(effect.max ?? Infinity, (n.growth[effect.stat] ?? 0) + (effect.amount ?? 1))
    grew += 1
  }
  if (grew) log?.push(`${grew} building${grew === 1 ? '' : 's'} next door grew.`)
})
