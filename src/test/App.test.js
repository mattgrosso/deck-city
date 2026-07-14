import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '@/App.vue'

// Phaser needs a real canvas/WebGL context, which jsdom doesn't provide, so
// it's mocked here rather than exercised in unit tests. The mocked Game
// never actually runs a scene lifecycle, so MainScene's create() never
// executes — this mock only needs to satisfy what PhaserGame.vue itself
// calls directly (constructing the game, and reading game.events).
vi.mock('phaser', () => {
  class Scene {
    constructor (key) {
      this.key = key
    }
  }

  return {
    default: {
      Game: vi.fn().mockImplementation(() => ({
        destroy: vi.fn(),
        events: { once: vi.fn(), on: vi.fn(), emit: vi.fn() }
      })),
      Scene,
      AUTO: 'AUTO',
      Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' }
    }
  }
})

describe('App', () => {
  it('mounts without crashing', () => {
    const wrapper = mount(App)
    expect(wrapper.exists()).toBe(true)
  })
})
