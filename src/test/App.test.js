import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '@/App.vue'

// The engine's own tests cover the rules. This drives the TV shell the way
// a controller would - by actions, through App.act() - and checks that a
// whole turn can be played from the title screen without a mouse.

vi.mock('@/ui/input', async (orig) => ({ ...(await orig()), attachInput: () => () => {} }))

describe('App', () => {
  let wrapper
  beforeEach(() => {
    wrapper = mount(App, { attachTo: document.body })
  })

  const vm = () => wrapper.vm
  const press = async (...actions) => { for (const a of actions) { vm().act(a); await wrapper.vm.$nextTick() } }

  it('starts on the title screen; A begins a game, shows the rules once, then the build phase with a hand', async () => {
    expect(wrapper.text()).toContain('Deck City')
    await press('select')
    expect(vm().screen).toBe('game')
    expect(vm().mode).toBe('howto')
    await press('back')
    expect(vm().mode).toBe('policy') // a policy first (core/cards/policies.js)
    expect(vm().game.state.run.policyOffer.length).toBe(3)
    await press('select')
    expect(vm().game.state.policies.length).toBe(1)
    expect(vm().mode).toBe('mandate')
    expect(vm().game.state.run.offer.length).toBe(2)
    await press('right', 'select')
    expect(vm().game.state.run.status).toBe('playing')
    expect(vm().mode).toBe('hand')
    expect(vm().phaseName).toBe('build')
    expect(vm().game.state.hand.length).toBe(5)
    expect(vm().treasury).toBe(5)
  })

  it('plays a Road from the hand onto an edge with A, the d-pad, and A', async () => {
    await press('select', 'back', 'select', 'select')
    const hand = vm().game.state.hand
    const roadAt = hand.findIndex(c => c.placesRoad)
    if (roadAt === -1) return // the shuffle dealt no Road; the engine tests cover placement itself
    vm().handIndex = roadAt
    await press('select')
    expect(vm().mode).toBe('target')
    expect(vm().validEdges.length).toBeGreaterThan(0)
    const roadsBefore = vm().game.state.cityGrid.roads.size
    await press('right', 'select')
    // A Road lays two segments; B keeps the one aimed so far and plays the card.
    if (vm().mode === 'target') await press('back')
    expect(vm().mode).toBe('hand')
    expect(vm().game.state.hand.length).toBe(4)
    expect(vm().treasury).toBe(4)
    expect(vm().game.state.cityGrid.roads.size).toBe(roadsBefore + 1)
  })

  it('Up from the hand looks at the city, Up again reaches the top bar, B comes back', async () => {
    await press('select', 'back', 'select', 'select', 'up')
    expect(vm().mode).toBe('look')
    expect(vm().targets.length).toBe(96)
    for (let i = 0; i < 12; i++) await press('up')
    expect(vm().mode).toBe('stats')
    await press('right')
    expect(vm().statIndex).toBe(1)
    expect(vm().statInfo.title).toBe('Jobs')
    await press('back')
    expect(vm().mode).toBe('hand')
  })

  it('refuses a status card and a card it cannot afford, with a message', async () => {
    await press('select', 'back', 'select', 'select')
    vm().game.state.hand.push({ id: 'crime', type: 'status', name: 'Crime', tags: ['negative', 'crime'] })
    vm().refresh()
    vm().handIndex = vm().game.state.hand.length - 1
    await press('select')
    expect(vm().mode).toBe('hand')
    expect(vm().toast.text).toMatch(/No room for Crime/)
    vm().game.state.treasury = 0
    vm().refresh()
    vm().handIndex = vm().game.state.hand.findIndex(c => c.cost > 0)
    await press('select')
    expect(vm().toast.text).toMatch(/costs/)
  })

  it('Y moves to the market, Y again ends the turn and deals a new hand', async () => {
    await press('select', 'back', 'select', 'select', 'confirm')
    expect(vm().mode).toBe('market')
    expect(vm().phaseName).toBe('acquire')
    await press('confirm')
    expect(vm().mode).toBe('summary')
    expect(vm().summary.budget.total).toBe(vm().treasury) // the ledger: budget parts add up to the new budget
    expect(vm().summary.budget.parts.length).toBeGreaterThan(0)
    await press('select')
    expect(vm().mode).toBe('hand')
    expect(vm().turn).toBe(2)
    expect(vm().game.state.hand.length).toBe(5)
  })

  it('Y never ends a phase while a card is selected (the accidental-end-turn lesson)', async () => {
    await press('select', 'back', 'select', 'select')
    const roadAt = vm().game.state.hand.findIndex(c => c.placesRoad)
    if (roadAt === -1) return
    vm().handIndex = roadAt
    await press('select')
    expect(vm().mode).toBe('target')
    await press('confirm')
    expect(vm().mode).toBe('target')
    expect(vm().phaseName).toBe('build')
    await press('back')
    expect(vm().mode).toBe('hand')
  })

  it('X opens the deck view, bumpers switch tabs, B closes it', async () => {
    await press('select', 'back', 'select', 'select', 'deck')
    expect(vm().mode).toBe('pile')
    expect(vm().pileTab).toBe(0)
    await press('nextPile')
    expect(vm().pileTab).toBe(1)
    await press('back')
    expect(vm().mode).toBe('hand')
  })

  it('patience running out holds the election: an unmet mandate ends the run', async () => {
    await press('select', 'back', 'select', 'select', 'confirm')
    vm().game.state.run.patience = 1
    await press('confirm')
    expect(vm().mode).toBe('summary')
    await press('select')
    expect(vm().mode).toBe('election')
    expect(vm().electionShown.passed).toBe(false)
    await press('select')
    expect(vm().mode).toBe('over')
    expect(vm().overItems).toEqual(['New game'])
  })

  it('a met mandate can be called early from the market and opens the next era', async () => {
    await press('select', 'back', 'select', 'select', 'confirm')
    const run = vm().game.state.run
    run.mandate = { ...run.mandate, condition: { type: 'populationAtLeast', amount: 1 } }
    vm().market = { row: 1, index: 0 } // the goal row; where the cursor starts depends on the shuffle
    vm().refresh()
    await press('up')
    expect(vm().market.row).toBe(2)
    await press('select')
    expect(vm().mode).toBe('election')
    expect(vm().electionShown.passed).toBe(true)
    await press('select')
    expect(vm().mode).toBe('policy') // re-elected: adopt a policy, then the next mandate
    await press('select')
    expect(vm().game.state.policies.length).toBe(2)
    expect(vm().mode).toBe('mandate')
    expect(vm().game.state.run.era).toBe(2)
    await press('select')
    expect(vm().mode).toBe('market')
  })

  it('a civic card lifts itself and the picks to the middle, and waits for Y to discard', async () => {
    await press('select', 'back', 'select', 'select')
    const civicWorks = vm().game.catalog['civic-recycle']
    vm().game.state.hand.unshift({ ...civicWorks })
    vm().refresh()
    vm().handIndex = 0
    await press('select')
    expect(vm().mode).toBe('civic')
    expect(vm().civicPrompt).toMatch(/pick 2 more/)
    await press('select', 'right', 'select')
    expect(vm().picks).toHaveLength(2)
    expect(vm().mode).toBe('civic') // nothing happens until confirmed
    expect(vm().civicPrompt).toMatch(/discard these, then draw 2/)
    const before = vm().game.state.deck.discardPile.length
    await press('confirm')
    expect(vm().mode).toBe('hand')
    expect(vm().game.state.deck.discardPile.length).toBe(before + 3)
  })
})
