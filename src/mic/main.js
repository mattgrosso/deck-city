// THE PHONE MICROPHONE (Matt, 2026-10-29: the Mac mini's mic can't hear him
// across the room, and macOS won't offer the iPhone as an input). Open
// mic.html on a phone, tap Start: the phone's own speech recognition hears
// him and drops each sentence in the TV's playtest inbox; the TV tags it
// with the game and files it (utils/playtest.js). A heartbeat tells the TV
// a phone is listening, so it mutes its own mic.
import { ref as dbRef, onValue, push, set, serverTimestamp } from 'firebase/database'
import { signInAnonymously } from 'firebase/auth'
import { db, auth } from '@/firebase'

const ROOT = 'deckCityPlaytest'
const $ = (id) => document.getElementById(id)
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition

let session = null
let listening = false
let rec = null
let lines = 0
let beat = null
let lock = null
let lastFinal = ''

const show = (html) => { $('state').innerHTML = html }
const heard = (text, final) => { $('heard').innerHTML = final ? `<b>${text.replace(/</g, '&lt;')}</b>` : text.replace(/</g, '&lt;') }

function render () {
  $('go').hidden = listening || !session || !Recognition
  $('stop').hidden = !listening
  if (!Recognition) return show('This browser can’t transcribe speech. On an iPhone, use Safari.')
  if (!session) return show('Waiting for the TV. Turn on Playtest mode there (press P, or the pause menu).')
  if (listening) return show(`<span class="dot"></span>Listening · ${lines} line${lines === 1 ? '' : 's'} sent`)
  show('Ready. Tap Start, then just talk as you play.')
}

async function keepAwake () {
  try { lock = await navigator.wakeLock?.request('screen') } catch { /* not offered: keep the screen on by hand */ }
}

function heartbeat () {
  if (!session) return
  set(dbRef(db, `${ROOT}/${session}/phone`), { at: serverTimestamp() }).catch(() => {})
}

function begin () {
  rec = new Recognition()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = navigator.language || 'en-US'
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      const text = r[0]?.transcript?.trim()
      if (!text) continue
      heard(text, r.isFinal)
      if (r.isFinal && text !== lastFinal && session) {
        lastFinal = text
        push(dbRef(db, `${ROOT}/${session}/inbox`), { text: text.slice(0, 2000), at: serverTimestamp() }).catch(() => {})
        lines++
        render()
      }
    }
  }
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stop(); show('The microphone was blocked. Allow it for this site, then tap Start.'); $('go').hidden = false }
  }
  // Recognition ends itself after a silence; start it again while listening.
  // If the phone refuses without a tap, the button comes back.
  rec.onend = () => {
    if (!listening) return
    setTimeout(() => {
      if (!listening) return
      try { rec.start() } catch { listening = false; render(); $('go').textContent = 'Tap to keep listening' }
    }, 250)
  }
  rec.start()
}

function start () {
  listening = true
  $('go').textContent = 'Start listening'
  try { begin() } catch { listening = false }
  heartbeat()
  clearInterval(beat)
  beat = setInterval(heartbeat, 15000)
  keepAwake()
  render()
}

function stop () {
  listening = false
  clearInterval(beat)
  try { rec?.stop() } catch { /* already stopped */ }
  if (session) set(dbRef(db, `${ROOT}/${session}/phone`), null).catch(() => {})
  lock?.release?.().catch?.(() => {})
  render()
}

$('go').addEventListener('click', start)
$('stop').addEventListener('click', stop)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && listening) keepAwake() })

async function main () {
  if (!db || !auth) return show('This build has no database to send to.')
  await signInAnonymously(auth).catch(() => {})
  onValue(dbRef(db, `${ROOT}/live`), (snap) => {
    const next = snap.val()
    if (next !== session) { session = next; if (listening) heartbeat() }
    render()
  }, () => show('Couldn’t reach the playtest. Check the connection and reload.'))
}
main()
