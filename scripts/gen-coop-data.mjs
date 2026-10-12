// Writes the co-op server's stage data (Lua) from the game's own stage configs.
//   npm run gen:coop [-- <out.lua>]   (default nakama/modules/skystriker_data.lua)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createServer } from 'vite'

const out = resolve(process.argv[2] ?? 'nakama/modules/skystriker_data.lua')
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const m = await vite.ssrLoadModule('/src/net/coop/coopData.ts')
  const data = m.buildCoopData()
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, m.toLua(data))
  const enemies = data.stages.reduce((n, s) => n + s.enemies.length, 0)
  console.log(`wrote ${out} · version ${data.version} · ${data.stages.length} stages · ${enemies} enemies`)
} finally {
  await vite.close()
}
