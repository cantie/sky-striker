// Heavy-scene bench: a boss fight at max weapon (NOVA), with extra explosions and enemy bullets poured in.
// Needs the dev server (the store handle is dev-only) and the `?stats` readout.
//   node scripts/fx-bench.mjs [baseUrl=http://localhost:5847] [seconds=20]
// Prints { fpsMedian, fpsP10, callsMedian }. Headless runs on software GL: compare builds with each other,
// not with a phone.
import { launchBrowser } from './art/preview.mjs'

const [base = 'http://localhost:5847', secs = '20'] = process.argv.slice(2)
const browser = await launchBrowser()
const page = await browser.newPage({ viewport: { width: 540, height: 960 } })
await page.goto(`${base}/?stats`, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.evaluate(() => {
  const st = window.__store
  st.setState((s) => ({ progress: { ...s.progress, plane: 'nova' } }))
  st.getState().startGame({ stageId: 4, easy: true, skipToBoss: true })
  setInterval(() => st.setState({ invincibleUntil: Date.now() + 10000 }), 200)
  setInterval(() => {
    const s = st.getState()
    if (s.gameState !== 'playing') return
    for (let i = 0; i < 3; i++) s.addExplosion(-6 + Math.random() * 12, 0.2, Math.random() * 16, Math.random() < 0.5 ? 1 : 1.6)
    for (let i = 0; i < 20; i++) {
      s.addBullet({ x: -7 + (14 * i) / 19, y: 0.3, z: 18, vx: 0, vy: 0, vz: -6, isEnemy: true, damage: 1, radius: 0.13 })
    }
  }, 250)
})
await page.waitForTimeout(4000)
const fps = [], calls = []
for (let i = 0; i < +secs; i++) {
  await page.waitForTimeout(1000)
  const s = await page.evaluate(() => window.__stats)
  if (s) { fps.push(s.fps); calls.push(s.calls) }
}
await browser.close()
const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))] ?? null }
console.log(JSON.stringify({ fpsMedian: q(fps, 0.5), fpsP10: q(fps, 0.1), callsMedian: q(calls, 0.5), samples: fps.length }))
