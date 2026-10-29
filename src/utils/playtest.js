// PLAYTEST MODE (Matt, 2026-10-29: "something that I can turn on and then
// it'll just record me and do a transcript and then you can react to the
// transcript"). The Commonwealth recipe, cut down to one player at one TV.
//
// Switched on from the pause menu (or P). The browser's own speech
// recognition (Web Speech) transcribes the microphone; each finished
// sentence is pushed to `deckCityPlaytest/<session>/lines`, tagged with
// where the game was (turn, era, what was on screen). Only the admin CLI
// reads it back: `yarn playtest:watch` while he plays, `yarn
// playtest:transcript` after. Claude answers on the TV with `yarn
// playtest:say "..."`, which lands in `notes`.
//
// The session id is kept in localStorage, so a reload carries on the same
// transcript rather than starting a new one.
import { ref as dbRef, set, push, onValue, serverTimestamp, query, orderByChild, limitToLast } from 'firebase/database'
import { signInAnonymously } from 'firebase/auth'
import { reactive } from 'vue'
import { db, auth } from '@/firebase'

const ROOT = 'deckCityPlaytest'
const KEY = 'deckCity:playtestSession'
const Recognition = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition

export const playtest = reactive({ on: false, sessionId: null, mic: 'off', lines: 0, heard: '', note: null })

const store = {
  get () { try { return window.localStorage.getItem(KEY) } catch { return null } },
  set (v) { try { v ? window.localStorage.setItem(KEY, v) : window.localStorage.removeItem(KEY) } catch { /* private window: the session just won't survive a reload */ } }
}

let stopMic = null
let offNotes = null
let heardTimer = null
let context = () => ({})

/** Keep listening until stopped: Chrome ends recognition after a silence, so it is restarted whenever it ends. */
function startMic (onLine) {
  const R = Recognition()
  if (!R) { playtest.mic = 'unsupported'; return () => {} }
  let stopped = false
  let rec = null
  const begin = () => {
    rec = new R()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = navigator.language || 'en-US'
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const text = r[0]?.transcript?.trim()
        if (!text) continue
        // Show what is being heard as it is heard, so the TV proves it is listening.
        playtest.heard = text
        clearTimeout(heardTimer)
        heardTimer = setTimeout(() => { playtest.heard = '' }, 6000)
        if (r.isFinal) onLine(text)
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stopped = true; playtest.mic = 'denied' }
    }
    rec.onend = () => { if (!stopped) setTimeout(() => { if (!stopped) { try { begin() } catch { playtest.mic = 'paused' } } }, 250) }
    try { rec.start(); playtest.mic = 'on' } catch { playtest.mic = 'paused' }
  }
  begin()
  return () => { stopped = true; try { rec?.stop() } catch { /* already stopped */ } playtest.mic = 'off' }
}

// Claude's replies: only ones newer than switching on, each shown for a while, queued.
const NOTE_MS = 20000
const queue = []
let noteTimer = null
let shownUpTo = 0
function showNext () {
  clearTimeout(noteTimer)
  const n = queue.shift()
  playtest.note = n ?? null
  if (n) noteTimer = setTimeout(showNext, queue.length ? 10000 : NOTE_MS)
}
function watchNotes (sessionId) {
  offNotes?.()
  shownUpTo = Date.now() - 60000
  offNotes = onValue(query(dbRef(db, `${ROOT}/${sessionId}/notes`), orderByChild('at'), limitToLast(6)), (snap) => {
    const fresh = Object.values(snap.val() || {}).filter(n => n?.text && (n.at || 0) > shownUpTo).sort((a, b) => a.at - b.at)
    if (!fresh.length) return
    shownUpTo = fresh[fresh.length - 1].at
    queue.push(...fresh)
    if (!playtest.note) showNext()
  }, () => {})
}

async function sendLine (text) {
  if (!playtest.sessionId || !auth?.currentUser) return
  playtest.lines++
  let where = {}
  try { where = context() } catch { /* a tag is never worth losing the line */ }
  await push(dbRef(db, `${ROOT}/${playtest.sessionId}/lines`), { text: text.slice(0, 2000), uid: auth.currentUser.uid, at: serverTimestamp(), ...where }).catch(() => {})
}

/** Is there anywhere to send a transcript? */
export const playtestAvailable = () => Boolean(db && auth)

/**
 * Switch playtest mode on. `where` is called for every line and returns
 * what the game looked like when it was said.
 */
export async function startPlaytest (where) {
  if (!playtestAvailable() || playtest.on) return
  context = where ?? context
  if (!auth.currentUser) await signInAnonymously(auth)
  const sessionId = store.get() || push(dbRef(db, ROOT)).key
  store.set(sessionId)
  playtest.sessionId = sessionId
  playtest.on = true
  set(dbRef(db, `${ROOT}/${sessionId}/on`), true).catch(() => {})
  watchNotes(sessionId)
  stopMic = startMic(sendLine)
}

export function stopPlaytest () {
  stopMic?.(); stopMic = null
  offNotes?.(); offNotes = null
  if (playtest.sessionId && db) set(dbRef(db, `${ROOT}/${playtest.sessionId}/on`), false).catch(() => {})
  store.set(null)
  Object.assign(playtest, { on: false, sessionId: null, mic: 'off', heard: '', note: null })
  queue.length = 0
}

/** A reload during a playtest picks the same session back up. */
export const playtestWasOn = () => Boolean(store.get())
