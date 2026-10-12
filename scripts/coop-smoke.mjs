// End-to-end smoke against a running Nakama with the co-op module (nakama/docker-compose.yml):
// two clients, create → join by code → READY → kill → both down → leaderboard row.
//   node scripts/coop-smoke.mjs [host=127.0.0.1] [port=7350]
import { Client } from '@heroiclabs/nakama-js'
import { createServer } from 'vite'

const [host = '127.0.0.1', port = '7350'] = process.argv.slice(2)
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { coopData } = await vite.ssrLoadModule('/src/net/coop/coopData.ts')
const data = coopData()
await vite.close()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const enc = (o) => JSON.stringify(o)
async function pilot(name, gid) {
  const client = new Client('defaultkey', host, port, false)
  // Same custom id as the game client
  const session = await client.authenticateCustom(`skystriker-${gid}`, true)
  const socket = client.createSocket(false, false)
  const inbox = []
  socket.onmatchdata = (d) => inbox.push({ op: d.op_code, data: JSON.parse(new TextDecoder().decode(d.data)) })
  await socket.connect(session, true)
  const rpc = async (id, p) => { const r = await client.rpc(session, id, p); return typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload }
  return { client, session, socket, inbox, rpc, meta: { name, plane: 'hawk', dataVersion: data.version } }
}
const phase = (p) => p.inbox.filter((m) => m.op === 106).at(-1)?.data.phase

try {
  const a = await pilot('ALPHA', 1), b = await pilot('BRAVO', 2)
  const room = await a.rpc('skystriker_create_match', {})
  console.log('room', room)
  const ma = await a.socket.joinMatch(room.matchId, undefined, a.meta)
  const found = await b.rpc('skystriker_join_code', { code: room.code })
  const mb = await b.socket.joinMatch(found.matchId, undefined, b.meta)
  for (const [p, m] of [[a, ma], [b, mb]]) await p.socket.sendMatchState(m.match_id, 6, enc({ name: 'x', plane: 'hawk', hp: 3, dataVersion: data.version }))
  await sleep(3500)
  if (phase(a) !== 'playing') throw new Error(`expected playing, got ${phase(a)}`)
  const first = data.stages[0].enemies.filter((e) => e.enterT !== null).sort((x, y) => x.enterT - y.enterT)[0]
  await sleep((first.enterT / data.rules.gameSpeed) * 1000 + 200)
  await a.socket.sendMatchState(ma.match_id, 2, enc({ hits: [[first.id, first.hp]] }))
  await sleep(300)
  if (!a.inbox.some((m) => m.op === 102 && m.data.id === first.id)) throw new Error('no ENEMY_DEAD')
  await a.socket.sendMatchState(ma.match_id, 3, enc({ hits: 3, hp: 0 }))
  await b.socket.sendMatchState(mb.match_id, 3, enc({ hits: 3, hp: 0 }))
  await sleep(500)
  if (phase(b) !== 'failed') throw new Error(`expected failed, got ${phase(b)}`)
  const lb = await a.rpc('skystriker_leaderboard', { board: 'kills' })
  console.log('leaderboard', JSON.stringify(lb))
  if (!lb.me || lb.me.names !== 'ALPHA & BRAVO') throw new Error('leaderboard row missing')
  console.log('SMOKE OK')
  process.exitCode = 0
} catch (e) {
  console.error('SMOKE FAILED:', e)
  process.exitCode = 1
} finally {
  setTimeout(() => process.exit(process.exitCode), 200)
}
