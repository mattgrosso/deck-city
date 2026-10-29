<template>
  <Teleport to="body">
    <button
      v-if="!isOpen"
      type="button"
      class="bug-trigger"
      title="Report a bug"
      aria-label="Report a bug"
      @click="open"
    >
      <!--
        Inlined SVG, not <i class="bi bi-bug-fill">. House rule (Matt): the
        bug button is Bootstrap's bug-fill, never the emoji - and this app
        doesn't load the bootstrap-icons FONT, so an icon-font class would
        render as an empty box. Same shape, no dependency.
      -->
      <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M4.355.522a.5.5 0 0 1 .623.333l.291.956A5 5 0 0 1 8 1c1.007 0 1.946.298 2.731.811l.29-.956a.5.5 0 1 1 .957.29l-.41 1.352A5 5 0 0 1 13 6h.5a.5.5 0 0 0 .5-.5V5a.5.5 0 0 1 1 0v.5A1.5 1.5 0 0 1 13.5 7H13v1h1.5a.5.5 0 0 1 0 1H13v1h.5a1.5 1.5 0 0 1 1.5 1.5v.5a.5.5 0 1 1-1 0v-.5a.5.5 0 0 0-.5-.5H13a5 5 0 0 1-10 0h-.5a.5.5 0 0 0-.5.5v.5a.5.5 0 1 1-1 0v-.5A1.5 1.5 0 0 1 2.5 10H3V9H1.5a.5.5 0 0 1 0-1H3V7h-.5A1.5 1.5 0 0 1 1 5.5V5a.5.5 0 0 1 1 0v.5a.5.5 0 0 0 .5.5H3c0-1.364.547-2.601 1.432-3.503l-.41-1.352a.5.5 0 0 1 .333-.623M8 2a4 4 0 0 0-4 4v3a4 4 0 1 0 8 0V6a4 4 0 0 0-4-4" />
      </svg>
    </button>

    <div v-if="isOpen" class="bug-backdrop" @click.self="close">
      <div class="bug-panel" role="dialog" aria-label="Report a bug">
        <h2>Report a bug</h2>
        <textarea
          ref="textarea"
          v-model="transcript"
          placeholder="What happened?"
          rows="5"
          :disabled="sending"
        ></textarea>
        <p class="bug-panel__note">
          The current game state is attached automatically.
        </p>
        <div class="bug-panel__actions">
          <button class="secondary" :disabled="sending" @click="close">Cancel</button>
          <button class="primary" :disabled="sending || !transcript.trim()" @click="send">
            {{ sending ? 'Sending…' : 'Send' }}
          </button>
        </div>
      </div>
    </div>

    <!--
      Confirmation is a TOAST, not a screen. Bug report (Matt, 2026-08-28):
      "for some of the bug buttons on this app and others you've added a
      confirmation screen. I don't need that submitting a message and then
      have it go away. I don't need to have to click another button."

      So sending closes the dialog immediately and this says what happened on
      its own time. It stays non-interactive on purpose - there is nothing to
      dismiss, which is the entire point. The offline case still gets said,
      because "saved on this device" is genuinely different news from "sent"
      and gets a longer read.
    -->
    <div v-if="toast" class="bug-toast" role="status" aria-live="polite">{{ toast }}</div>
  </Teleport>
</template>

<script>
import { submitBugReport } from '@/utils/bugReports';
import { buildBugContext } from '@/utils/bugContext';

export default {
  name: 'BugReportButton',
  data () {
    return {
      isOpen: false, transcript: '', sending: false, toast: '',
    };
  },
  // Deck City has no store: App.vue provides `bugSnapshot()`, which returns
  // { gameState, user, context } for the report (house-module adaptation).
  inject: { bugSnapshot: { default: () => () => ({}) } },
  computed: {
    snapshot () { return this.bugSnapshot(); },
    game () { return this.snapshot.gameState || null; },
    user () { return this.snapshot.user || null; },
    roomId () { return null; },
    roomMeta () { return null; },
  },
  beforeUnmount () {
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
  },
  methods: {
    open () {
      this.isOpen = true;
      this.$nextTick(() => this.$refs.textarea?.focus());
    },
    close () {
      this.isOpen = false;
      this.transcript = '';
      this.sending = false;
    },
    async send () {
      this.sending = true;
      const { sent } = await submitBugReport({
        transcript: this.transcript,
        gameState: this.game,
        reporter: this.user
          ? { uid: this.user.uid, displayName: this.user.displayName || null }
          : null,
        context: this.gatherContext(),
      });
      this.sending = false;
      // Straight out of the way, then say what happened.
      this.close();
      this.showToast(sent
        ? 'Bug report sent — thanks!'
        : "Saved on this device — it'll send next time you're online.", sent ? 2400 : 4000);
    },
    // Everything that could help (utils/bugContext.js). A failure here must
    // never stop the report itself, so it degrades to the bare minimum.
    gatherContext () {
      try {
        return buildBugContext({ state: { user: this.user } }, this.snapshot.context || {});
      } catch (e) {
        return {
          online: Boolean(this.roomId),
          roomCode: this.roomMeta?.roomCode || null,
          uid: this.user?.uid || null,
          gatherError: String(e?.message || e).slice(0, 200),
        };
      }
    },
    showToast (message, ms) {
      this.toast = message;
      if (this.toastTimer) window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(() => { this.toast = ''; }, ms);
    },
  },
};
</script>

<style scoped>
/* Bottom-LEFT, deliberately. The install prompt already owns the top-right,
   and the two action buttons own the bottom edge on a phone - this is the
   one corner that never sits under something you tap mid-game. */
.bug-trigger {
  position: fixed;
  left: 0.5rem;
  bottom: calc(0.5rem + var(--safe-bottom));
  z-index: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-height: 40px;
  border-radius: 50%;
  border: 1px solid #3a4d43;
  background: rgba(34, 49, 42, 0.85);
  color: #b9c6bf;
  opacity: 0.55;
}
.bug-trigger:active { opacity: 1; }

.bug-backdrop {
  position: fixed;
  inset: 0;
  z-index: 950;
  background: rgba(0, 0, 0, 0.65);
  display: grid;
  place-items: center;
  padding: 1.25rem;
}

.bug-panel {
  width: 100%;
  max-width: 420px;
  padding: 1.2rem 1.3rem;
  border-radius: 14px;
  background: #22312a;
  border: 1px solid #3a4d43;
  color: #f2f5f3;
}

.bug-panel h2 { margin: 0 0 0.8rem; font-size: 1.15rem; }

.bug-panel textarea {
  width: 100%;
  font: inherit;
  padding: 0.6rem 0.7rem;
  border-radius: 10px;
  border: 1px solid #3a4d43;
  background: #1d2b24;
  color: #f2f5f3;
  resize: vertical;
}

.bug-panel__note {
  margin: 0.7rem 0 0;
  font-size: 0.78rem;
  color: #b9c6bf;
  line-height: 1.5;
}

.bug-panel__actions {
  display: flex;
  gap: 10px;
  margin-top: 1rem;
}
.bug-panel__actions > * { flex: 1; }

/* See the template note: the confirmation is a toast because the old one was
   a second screen with a button to dismiss it. Pointer-events off so it can
   never intercept a tap meant for the game underneath. */
.bug-toast {
  position: fixed;
  left: 50%;
  bottom: calc(1.25rem + var(--safe-bottom));
  transform: translateX(-50%);
  z-index: 960;
  max-width: min(22rem, calc(100vw - 2rem));
  padding: 0.6rem 0.95rem;
  border-radius: 999px;
  background: rgba(20, 20, 20, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #f4f4f4;
  font-size: 0.85rem;
  text-align: center;
  pointer-events: none;
  animation: bug-toast-in 160ms ease-out;
}

@keyframes bug-toast-in {
  from { opacity: 0; transform: translate(-50%, 6px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .bug-toast { animation: none; }
}
</style>
