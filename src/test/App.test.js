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
    expect(vm().mode).toBe('hand')
    expect(vm().phaseName).toBe('build')
    expect(vm().game.state.hand.length).toBe(5)
    expect(vm().treasury).toBe(6)
  })

  it('plays a Road from the hand onto an edge with A, the d-pad, and A', async () => {
    await press('select', 'back')
    const hand = vm().game.state.hand
    const roadAt = hand.findIndex(c => c.placesRoad)
    if (roadAt === -1) return // the shuffle dealt no Road; the engine tests cover placement itself
    vm().handIndex = roadAt
    await press('select')
    expect(vm().mode).toBe('target')
    expect(vm().validEdges.length).toBeGreaterThan(0)
    const roadsBefore = vm().game.state.cityGrid.roads.size
    await press('right', 'select')
    expect(vm().mode).toBe('hand')
    expect(vm().game.state.hand.length).toBe(4)
    expect(vm().treasury).toBe(5)
    expect(vm().game.state.cityGrid.roads.size).toBe(roadsBefore + 1)
  })

  it('Up from the hand looks at the city, Up again reaches the top bar, B comes back', async () => {
    await press('select', 'back', 'up')
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
    await press('select', 'back')
    vm().game.state.hand.push({ id: 'crime', type: 'status', name: 'Crime', tags: ['negative', 'crime'] })
    vm().refresh()
    vm().handIndex = vm().game.state.hand.length - 1
    await press('select')
    expect(vm().mode).toBe('hand')
    expect(vm().toast.text).toMatch(/No free slot/)
    vm().game.state.treasury = 0
    vm().refresh()
    vm().handIndex = vm().game.state.hand.findIndex(c => c.cost > 0)
    await press('select')
    expect(vm().toast.text).toMatch(/costs/)
  })

  it('Y moves to the market, Y again ends the turn and deals a new hand', async () => {
    await press('select', 'back', 'confirm')
    expect(vm().mode).toBe('market')
    expect(vm().phaseName).toBe('acquire')
    await press('confirm')
    expect(vm().mode).toBe('summary')
    expect(vm().summary.lines.join(' ')).toMatch(/Budget this turn/)
    await press('select')
    expect(vm().mode).toBe('hand')
    expect(vm().turn).toBe(2)
    expect(vm().game.state.hand.length).toBe(5)
  })

  it('Y never ends a phase while a card is selected (the accidental-end-turn lesson)', async () => {
    await press('select', 'back')
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
    await press('select', 'back', 'deck')
    expect(vm().mode).toBe('pile')
    expect(vm().pileTab).toBe(0)
    await press('nextPile')
    expect(vm().pileTab).toBe(1)
    await press('back')
    expect(vm().mode).toBe('hand')
  })
})
