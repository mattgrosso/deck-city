// One input vocabulary for the whole game (docs/STS-LESSONS.md §6), fed by
// a gamepad, the keyboard, or both at once. Everything above this file
// speaks in actions - 'left', 'select', 'back', 'confirm' - never buttons.
//
//   up / down / left / right   d-pad, left stick, arrow keys, WASD
//   select                     A, Enter, Space
//   back                       B, Escape, Backspace
//   confirm                    Y, E            (end the phase; see §6 on why
//                                               it is its own button)
//   deck                       X, Tab           (the deck/pile view)
//   prevPile / nextPile        LB / RB, Q / R
//   menu                       Start, M
//
// Holding a direction repeats it: a first repeat after REPEAT_DELAY_MS, then
// one every REPEAT_RATE_MS, so walking a long row is quick but a tap is one
// step. The gamepad is polled on requestAnimationFrame; the Gamepad API
// has no events for buttons, only for connection.

export const REPEAT_DELAY_MS = 350
export const REPEAT_RATE_MS = 120
export const STICK_DEADZONE = 0.5

// Standard-mapping button indexes (W3C Gamepad API "standard" layout).
const BUTTONS = {
  0: 'select', // A / Cross
  1: 'back', // B / Circle
  2: 'deck', // X / Square
  3: 'confirm', // Y / Triangle
  4: 'prevPile', // LB
  5: 'nextPile', // RB
  9: 'menu', // Start
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right'
}

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Enter: 'select', Space: 'select',
  Escape: 'back', Backspace: 'back',
  KeyE: 'confirm',
  Tab: 'deck',
  KeyQ: 'prevPile', KeyR: 'nextPile',
  KeyM: 'menu'
}

export const DIRECTIONS = ['up', 'down', 'left', 'right']

/**
 * The set of actions a gamepad is asking for right now, from its raw
 * buttons and axes. Pure: tested without a browser.
 * @param {{buttons: {pressed: boolean}[], axes: number[]}} pad
 * @returns {Set<string>}
 */
export function actionsFromGamepad (pad) {
  const held = new Set()
  if (!pad) return held
  pad.buttons.forEach((button, index) => {
    if (button?.pressed && BUTTONS[index]) held.add(BUTTONS[index])
  })
  const [x = 0, y = 0] = pad.axes
  if (x < -STICK_DEADZONE) held.add('left')
  if (x > STICK_DEADZONE) held.add('right')
  if (y < -STICK_DEADZONE) held.add('up')
  if (y > STICK_DEADZONE) held.add('down')
  return held
}

/** The action a key press maps to, or undefined. */
export function actionFromKey (code) {
  return KEYS[code]
}

/**
 * Turns "what is held right now" into "what fires this frame": edges for
 * buttons, edges plus timed repeats for directions.
 */
export function createRepeater ({ delay = REPEAT_DELAY_MS, rate = REPEAT_RATE_MS } = {}) {
  const since = new Map() // action -> { pressedAt, lastFiredAt }
  return {
    /**
     * @param {Set<string>} held
     * @param {number} now - milliseconds
     * @returns {string[]} actions to fire this frame
     */
    tick (held, now) {
      const fired = []
      for (const action of held) {
        const entry = since.get(action)
        if (!entry) {
          since.set(action, { pressedAt: now, lastFiredAt: now })
          fired.push(action)
        } else if (DIRECTIONS.includes(action)) {
          const heldFor = now - entry.pressedAt
          if (heldFor >= delay && now - entry.lastFiredAt >= rate) {
            entry.lastFiredAt = now
            fired.push(action)
          }
        }
      }
      for (const action of [...since.keys()]) {
        if (!held.has(action)) since.delete(action)
      }
      return fired
    },
    reset () { since.clear() }
  }
}

/**
 * Wires the browser's gamepads and keyboard to a handler. Returns a stop
 * function. `onPadChange(connected)` lets the UI say "controller connected".
 */
export function attachInput ({ onAction, onPadChange = () => {}, raf = window.requestAnimationFrame.bind(window) }) {
  const repeater = createRepeater()
  let running = true
  let hadPad = false

  const poll = () => {
    if (!running) return
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []
    const hasPad = pads.length > 0
    if (hasPad !== hadPad) { hadPad = hasPad; onPadChange(hasPad) }
    const held = new Set()
    pads.forEach(pad => actionsFromGamepad(pad).forEach(action => held.add(action)))
    repeater.tick(held, performance.now()).forEach(action => onAction(action, 'pad'))
    raf(poll)
  }
  raf(poll)

  const keyRepeater = createRepeater()
  const keysHeld = new Set()
  let keyTimer = null
  const pumpKeys = () => {
    keyRepeater.tick(keysHeld, performance.now()).forEach(action => onAction(action, 'key'))
    keyTimer = keysHeld.size ? setTimeout(pumpKeys, 30) : null
  }
  const onKeyDown = (event) => {
    const action = actionFromKey(event.code)
    if (!action) return
    if (event.target && /^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return
    event.preventDefault()
    if (event.repeat) return // we do our own repeating
    keysHeld.add(action)
    if (!keyTimer) pumpKeys()
  }
  const onKeyUp = (event) => {
    const action = actionFromKey(event.code)
    if (action) keysHeld.delete(action)
  }
  const onBlur = () => { keysHeld.clear(); keyRepeater.reset(); repeater.reset() }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  return () => {
    running = false
    if (keyTimer) clearTimeout(keyTimer)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
  }
}
