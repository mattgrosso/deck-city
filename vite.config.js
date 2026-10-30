import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// The house modules under src/utils and src/components/shared are copies of
// the hub games' (res-arcana was the source, 2026-10-29). They read
// `process.env.VUE_APP_*` / `process.env.BASE_URL` the way Vue CLI exposed
// them, so those are defined here rather than the files rewritten - the
// shared source stays shared. checkForUpdate.js reads the hashed entry
// bundle's name off index.html as js/app.<hex>.js; the rollup output
// options below are what make the bundle come out that way.

const GIT_CANDIDATES = ['/opt/homebrew/bin/git', '/usr/bin/git', 'git']
function resolveGit () {
  for (const bin of GIT_CANDIDATES) {
    try { execSync(`${bin} --version`, { stdio: 'pipe' }); return bin } catch { /* next */ }
  }
  return null
}
const GIT = resolveGit()
function safeGit (args, fallback) {
  if (!GIT) return fallback
  try { return execSync(`${GIT} ${args}`, { encoding: 'utf8' }).trim() } catch { return fallback }
}
const gitSha = safeGit('rev-parse --short HEAD', 'unknown')
const isDirty = safeGit('status --porcelain', '') !== ''
const buildTime = new Date().toISOString()

const FIREBASE_KEYS = [
  'VUE_APP_FIREBASE_API_KEY', 'VUE_APP_FIREBASE_AUTH_DOMAIN', 'VUE_APP_FIREBASE_DATABASE_URL',
  'VUE_APP_FIREBASE_PROJECT_ID', 'VUE_APP_FIREBASE_STORAGE_BUCKET',
  'VUE_APP_FIREBASE_MESSAGING_SENDER_ID', 'VUE_APP_FIREBASE_APP_ID'
]

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VUE_APP_')
  const define = {
    'process.env.VUE_APP_GIT_SHA': JSON.stringify(gitSha + (isDirty ? '-dirty' : '')),
    'process.env.VUE_APP_BUILD_TIME': JSON.stringify(buildTime),
    'process.env.BASE_URL': JSON.stringify('/')
  }
  for (const key of FIREBASE_KEYS) {
    if (env[key] !== undefined) define[`process.env.${key}`] = JSON.stringify(env[key])
  }

  return {
    base: '/',
    envPrefix: ['VUE_APP_', 'VITE_'],
    define,
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        input: { app: fileURLToPath(new URL('./index.html', import.meta.url)), mic: fileURLToPath(new URL('./mic.html', import.meta.url)) },
        output: {
          hashCharacters: 'hex',
          entryFileNames: 'js/[name].[hash].js',
          chunkFileNames: 'js/[name].[hash].js',
          assetFileNames: (info) => (/\.css$/i.test(info.name || '') ? 'css/[name].[hash][extname]' : 'assets/[name].[hash][extname]')
        }
      }
    },
    plugins: [
      vue(),
      VitePWA({
        strategies: 'generateSW',
        filename: 'service-worker.js',
        registerType: 'autoUpdate',
        injectRegister: false,
        manifest: false,
        workbox: {
          globPatterns: ['**/*'],
          // models/ is ~11 MB of GLBs: fetched on demand and cached by the
          // browser (CloudFront serves them immutable), never precached.
          globIgnores: ['**/*.map', 'version.json', 'index.html', 'models/**'],
          dontCacheBustURLsMatching: /\.[0-9a-f]{8}\.(js|css)$/,
          cacheId: 'deck-city',
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          navigateFallback: null,
          runtimeCaching: [{
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'app-shell', networkTimeoutSeconds: 3 }
          }]
        }
      })
    ]
  }
})
