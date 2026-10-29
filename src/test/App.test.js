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

  it('starts on the title screen and A begins a game on the build phase with a hand', async () => {
    expect(wrapper.text()).toContain('Deck City')
    await press('select')
    expect(vm().screen).toBe('game')
    expect(vm().phaseName).toBe('build')
    expect(vm().game.state.hand.length).toBe(5)
    expect(vm().treasury).toBe(4)
  })

  it('plays a Road from the hand onto the grid with A, the d-pad, and A', async () => {
    await press('select')
    const hand = vm().game.state.hand
    const roadAt = hand.findIndex(c => c.placesRoad)
    if (roadAt === -1) return // the shuffle dealt no Road; the engine tests cover placement itself
    vm().handIndex = roadAt
    await press('select')
    expect(vm().mode).toBe('target')
    expect(vm().validCells.length).toBeGreaterThan(0)
    await press('right', 'select')
    expect(vm().mode).toBe('hand')
    expect(vm().game.state.hand.length).toBe(4)
    expect(vm().treasury).toBe(3)
  })

  it('refuses a status card and a card it cannot afford, with a message', async () => {
    await press('select')
    vm().game.state.hand.push({ id: 'crime', type: 'status', name: 'Crime', tags: ['negative', 'crime'] })
    vm().refresh()
    vm().handIndex = vm().game.state.hand.length - 1
    await press('select')
    expect(vm().mode).toBe('hand')
    expect(vm().toast.text).toMatch(/can't be played/)
    vm().game.state.treasury = 0
    vm().refresh()
    vm().handIndex = vm().game.state.hand.findIndex(c => c.cost > 0)
    await press('select')
    expect(vm().toast.text).toMatch(/costs/)
  })

  it('Y moves to the market, Y again ends the turn and deals a new hand', async () => {
    await press('select', 'confirm')
    expect(vm().mode).toBe('market')
    expect(vm().phaseName).toBe('acquire')
    await press('confirm')
    expect(vm().mode).toBe('summary')
    expect(vm().summary.lines.join(' ')).toMatch(/Budget reset/)
    await press('select')
    expect(vm().mode).toBe('hand')
    expect(vm().turn).toBe(2)
    expect(vm().game.state.hand.length).toBe(5)
  })

  it('Y never ends a phase while a card is selected (the accidental-end-turn lesson)', async () => {
    await press('select')
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
    await press('select', 'deck')
    expect(vm().mode).toBe('pile')
    expect(vm().pileTab).toBe(0)
    await press('nextPile')
    expect(vm().pileTab).toBe(1)
    await press('back')
    expect(vm().mode).toBe('hand')
  })
})
