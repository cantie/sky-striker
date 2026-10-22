// Every screen at every frame size: reports inner scrollbars (a screen taller than its box) and text or
// buttons that fall outside the game's column, and exits 1 if there are any. Needs the dev server (the
// store handle is dev-only). Re-run it after changing a screen; a tall one goes in fit.ts's TALL.
//   node scripts/ui-fit-check.mjs [baseUrl=http://localhost:5847] [sizes=WxH,...] [screens=a,b] [--shots=dir]
import { mkdirSync } from 'node:fs'
import { launchBrowser } from './art/preview.mjs'
const args = process.argv.slice(2)
const shots = args.find((a) => a.startsWith('--shots='))?.slice(8)
const [base = 'http://localhost:5847', sizesArg, screensArg] = args.filter((a) => !a.startsWith('--'))
if (shots) mkdirSync(shots, { recursive: true })
const SIZES = (sizesArg ?? '1135x660,1280x720,800x600,1024x500,360x640,390x844,412x915,768x1024,1920x1080').split(',').map((s) => s.split('x').map(Number))
const ALL = ['menu', 'stageSelect', 'briefing', 'hangar', 'leaderboard', 'coopLobby', 'playing', 'paused', 'bossWarning', 'results', 'coopStageClear', 'coopResults']
const SCREENS = screensArg ? screensArg.split(',') : ALL

const go = {
  menu: (st) => st.getState().setGameState('menu'),
  stageSelect: (st) => st.getState().goToStageSelect(),
  briefing: (st) => st.getState().openBriefing(1),
  hangar: (st) => { st.getState().setGameState('menu'); st.getState().openHangar() },
  leaderboard: (st) => { st.getState().setGameState('menu'); st.getState().openLeaderboard('solo') },
  coopLobby: (st) => st.getState().openCoopLobby(),
  playing: (st) => { st.getState().startGame({ stageId: 1, easy: true }) },
  paused: (st) => { st.getState().startGame({ stageId: 1, easy: true }); st.getState().pauseGame() },
  bossWarning: (st) => { st.getState().startGame({ stageId: 1, easy: true }); st.setState({ gameState: 'bossWarning' }) },
  results: (st) => { st.getState().startGame({ stageId: 1, easy: true }); st.getState().finishStageWin() },
  coopStageClear: (st) => st.setState({ gameState: 'coopStageClear' }),
  coopResults: (st) => st.setState({ gameState: 'coopResults' }),
}

const browser = await launchBrowser()
const report = []
for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(`${base}/`, { waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__store, null, { timeout: 60000 })
  await page.waitForTimeout(1200)
  for (const screen of SCREENS) {
    await page.evaluate((code) => { const st = window.__store; (0, eval)(code)(st) }, `(${go[screen].toString()})`)
    await page.waitForTimeout(900)
    const r = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      // The App's column (it holds the canvas and the UI); R3F's own wrapper is overflow-hidden too
      const frame = canvas.closest('div[style*="box-shadow"]')
      const fr = frame.getBoundingClientRect()
      const label = (el) => (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
      const scrolls = [], clipped = []
      for (const el of frame.querySelectorAll('*')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.tagName === 'CANVAS') continue
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) scrolls.push({ what: label(el), over: el.scrollHeight - el.clientHeight })
        if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) scrolls.push({ what: 'X ' + label(el), over: el.scrollWidth - el.clientWidth })
      }
      // Leaf text and buttons that stick out of the column (or of a scroll box that hides them)
      for (const el of frame.querySelectorAll('button, span, div, p, h1, h2, h3, a, input')) {
        if (el.children.length && el.tagName !== 'BUTTON') continue
        if (!(el.innerText || '').trim() && el.tagName !== 'BUTTON' && el.tagName !== 'INPUT') continue
        const b = el.getBoundingClientRect()
        if (!b.width || !b.height) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || +cs.opacity === 0) continue
        const out = Math.max(fr.left - b.left, b.right - fr.right, fr.top - b.top, b.bottom - fr.bottom)
        if (out > 1) clipped.push({ what: label(el), out: Math.round(out) })
      }
      return { frame: [Math.round(fr.width), Math.round(fr.height)], page: document.scrollingElement.scrollHeight > innerHeight + 1, scrolls, clipped }
    })
    report.push({ size: `${w}x${h}`, screen, ...r })
    if (shots) await page.screenshot({ path: `${shots}/${w}x${h}-${screen}.png` })
  }
  if (errors.length) report.push({ size: `${w}x${h}`, errors })
  await page.close()
}
await browser.close()
let bad = 0
for (const r of report) {
  if (r.errors) { bad++; console.log(`${r.size} ERRORS ${r.errors.join(' | ')}`); continue }
  const off = r.scrolls.length || r.clipped.length || r.page
  if (off) bad++
  console.log(`${off ? 'BAD ' : 'ok  '} ${r.size.padEnd(9)} ${r.screen.padEnd(14)} frame ${r.frame.join('x')}` +
    (r.page ? ' PAGE-SCROLL' : '') +
    (r.scrolls.length ? ` scroll[${r.scrolls.map((s) => `${s.what}+${s.over}`).join('; ')}]` : '') +
    (r.clipped.length ? ` clipped[${r.clipped.slice(0, 4).map((c) => `${c.what}:${c.out}`).join('; ')}${r.clipped.length > 4 ? ` +${r.clipped.length - 4}` : ''}]` : ''))
}
console.log(bad ? `${bad} problem(s)` : 'every screen fits')
process.exitCode = bad ? 1 : 0
