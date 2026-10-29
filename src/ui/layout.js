// Fan geometry for the hand (docs/STS-LESSONS.md §2). Pure functions so the
// hand's shape is testable without a DOM: given a hand size and which card
// has focus, where does each card sit, how is it rotated, how big is it.
//
// The stage is a fixed 1920×1080 picture (see style.css); every number here
// is in stage pixels.

export const CARD_W = 200
export const CARD_H = 292
export const FOCUS_SCALE = 1.25

/**
 * @param {number} count - cards in hand
 * @param {number|null} focused - index of the focused card, or null
 * @param {Object} [opts]
 * @param {number} [opts.width] - horizontal room the fan may use
 * @returns {{x:number, y:number, rot:number, scale:number, z:number}[]}
 *   x/y are the card's centre; rot in degrees; z the stacking order.
 */
export function fanLayout (count, focused = null, { width = 1100 } = {}) {
  if (count <= 0) return []
  // Overlap tightens as the hand grows, so ten cards still fit the room.
  const spread = Math.min(CARD_W * 0.8, width / Math.max(count, 1))
  const total = spread * (count - 1)
  const start = -total / 2
  // A gentle arc: outer cards sit a little lower and lean outward.
  const maxRot = Math.min(4 * (count - 1), 22)
  const maxDrop = Math.min(6 * (count - 1), 34)

  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1 // -1 .. 1
    let x = start + spread * i
    let y = Math.abs(t) * maxDrop
    let rot = t * maxRot
    let scale = 1
    let z = i
    if (focused !== null) {
      if (i === focused) {
        y = -118
        rot = 0
        scale = FOCUS_SCALE
        z = count + 1
      } else {
        // Neighbours slide away so the big card never covers them.
        const push = (CARD_W * FOCUS_SCALE - spread) / 2 + 14
        x += i < focused ? -push : push
      }
    }
    return { x, y, rot, scale, z }
  })
}

/**
 * Which cell the grid cursor lands on when the d-pad is pressed: the nearest
 * valid cell in that direction, measured first along the axis of travel and
 * then by sideways drift, so a column of valid cells walks straight. Returns
 * the current cell when nothing lies that way.
 * @param {{x:number,y:number}} from
 * @param {'up'|'down'|'left'|'right'} dir
 * @param {{x:number,y:number}[]} valid
 */
export function stepCursor (from, dir, valid) {
  const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0
  const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0
  let best = null
  let bestScore = Infinity
  for (const cell of valid) {
    const ax = cell.x - from.x
    const ay = cell.y - from.y
    const along = ax * dx + ay * dy
    if (along <= 0) continue
    const across = Math.abs(ax * dy) + Math.abs(ay * dx)
    // Sideways drift costs more than distance, so a column walks straight;
    // anything more than ~60° off the pressed direction is not "that way".
    if (across > along * 1.8) continue
    const score = along + across * 2
    if (score < bestScore) { bestScore = score; best = cell }
  }
  return best ?? from
}

/** The valid cell nearest to a point, for seeding the cursor. */
export function nearestCell (to, valid) {
  let best = null
  let bestDist = Infinity
  for (const cell of valid) {
    const d = Math.abs(cell.x - to.x) + Math.abs(cell.y - to.y)
    if (d < bestDist) { bestDist = d; best = cell }
  }
  return best
}
