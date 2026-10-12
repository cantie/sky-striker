// Dev-only playtest bot: node .bot_test.mjs <url> <seconds> [out.png]
import { chromium } from 'playwright'
const [url = 'http://localhost:5847/', secs = '140', out = '.bot.png'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 540, height: 960 } })
const logs = []
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(2500)
const t0 = Date.now()
await page.evaluate(() => {
  const st = window.__store
  if (!new URLSearchParams(location.search).has('coop')) st.getState().startGame({ stageId: 1 })
  // Bot: never dies, hovers under the nearest enemy / boss
  setInterval(() => {
    const s = st.getState()
    if (s.gameState !== 'playing') return
    st.setState({ invincibleUntil: Date.now() + 10000 })
    const targets = [...s.enemies.filter((e) => e.entered), ...(s.boss ? [s.boss] : [])]
    let tx = 0
    if (targets.length) tx = targets.reduce((a, b) => (Math.abs(b.x - s.playerX) < Math.abs(a.x - s.playerX) ? b : a)).x
    s.setPlayerPosition(s.playerX + Math.max(-0.25, Math.min(0.25, tx - s.playerX)), -4)
  }, 30)
})
let bossAt = null, last = ''
while ((Date.now() - t0) / 1000 < +secs) {
  await page.waitForTimeout(2000)
  const r = await page.evaluate(() => {
    const s = window.__store.getState()
    return { state: s.gameState, wave: s.waveIndex, boss: !!s.boss, bossHp: s.boss?.hp, stats: s.runStats, enemies: s.enemies.length, stars: s.stars, score: s.score, weapon: s.weaponPower, seed: s.runSeed, mode: s.mode, sim: +window.__sim.simTime().toFixed(1), extra: window.__coopDebug?.() }
  })
  const line = JSON.stringify(r)
  if (line !== last) console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', line)
  last = line
  if (bossAt === null && (r.state === 'bossWarning' || r.boss)) { bossAt = (Date.now() - t0) / 1000; console.log('BOSS at', bossAt.toFixed(1), 's') }
  if (r.state === 'results') break
}
await page.screenshot({ path: out })
console.log(logs.length ? logs.slice(0, 20).join('\n') : 'no console errors/warnings')
await browser.close()
