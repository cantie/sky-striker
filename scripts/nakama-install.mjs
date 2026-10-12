// Copies the co-op Lua modules into the Nakama cluster repo (default ../nakama-cluster).
//   NAKAMA_CLUSTER_DIR=/path npm run nakama:install
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const target = resolve(process.env.NAKAMA_CLUSTER_DIR ?? '../nakama-cluster', 'modules')
if (!existsSync(target)) {
  console.error(`No modules directory at ${target} (set NAKAMA_CLUSTER_DIR)`)
  process.exit(1)
}
for (const f of ['skystriker_coop.lua', 'skystriker_data.lua']) {
  copyFileSync(resolve('nakama/modules', f), resolve(target, f))
  console.log(`copied ${f} → ${target}`)
}
