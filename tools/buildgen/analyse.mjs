import { readdirSync } from 'fs'
import { readGlb, cleanCuts } from './glb.mjs'
for (const kit of ['commercial', 'suburban', 'industrial']) {
  for (const f of readdirSync(`public/models/${kit}`).filter(f => f.startsWith('building') && f.endsWith('.glb'))) {
    const { top, cuts } = cleanCuts(readGlb(`public/models/${kit}/${f}`))
    console.log(`${kit}/${f.replace('.glb', '')} top ${top} cuts ${cuts.join(' ')}`)
  }
}
