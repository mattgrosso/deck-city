import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VUE_APP_FIREBASE_API_KEY,
  authDomain: process.env.VUE_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VUE_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.VUE_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VUE_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VUE_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VUE_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// getDatabase() throws immediately (fatally, before Vue even mounts) if
// databaseURL isn't set, and getAuth() misbehaves without an apiKey. Local
// hotseat/solo play needs to work with zero Firebase project configured (see
// plan, "multiplayer sync" - solo/hotseat is local-only, no Firebase writes
// at all), so both are guarded and null when unconfigured. Remote multiplayer
// (Milestone 5) and Google sign-in will need a real .env.local to work.
export const db = firebaseConfig.databaseURL ? getDatabase(app) : null;
export const auth = firebaseConfig.apiKey ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
// App.vue's login+approval gate has nothing to gate against without a
// real project (no db/auth) - same "local play still works" fallback as
// db/auth themselves, just named for that specific call site.
export const firebaseConfigured = Boolean(db && auth);
