// Renders every card's picture (src/world/cardArt.js) to public/art/<id>.png
// through dev-art.html on a running dev server. Usage, with `yarn dev`
// (or any port) up:  node scripts/render-card-art.mjs http://localhost:5177
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = process.argv[2] || 'http://localhost:5173'
// Playwright lives in a sibling repo on this machine; no dependency added here.
const { chromium } = createRequire('/Users/mjg/code/meal-hat/package.json')('playwright')
// cardArt.js uses the app's '@' alias, so the ids are read off its source rather than imported.
const src = readFileSync(join(root, 'src/world/cardArt.js'), 'utf8')
const ids = [...src.matchAll(/^ {2}'?([a-z-]+)'?: scene\(/gm)].map(m => m[1])
mkdirSync(join(root, 'public/art'), { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 640, height: 400 } })
for (const id of ids) {
  await page.goto(`${base}/dev-art.html?card=${id}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__artReady, null, { timeout: 20000 })
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(root, `public/art/${id}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 640, height: 400 } })
  console.log('art:', id)
}
await browser.close()
