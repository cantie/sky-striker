// usage: node scripts_shot.mjs <url> <out.png> [w] [h] [waitMs] [actions-json]
import { chromium } from 'playwright'
const [url, out, w = 1280, h = 800, wait = 3000, actions = '[]'] = process.argv.slice(2)
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const mobile = +w < 600
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
const logs = []
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(+wait)
for (const a of JSON.parse(actions)) {
  if (a.click) await page.click(a.click)
  if (a.key) await page.keyboard.down(a.key), await page.waitForTimeout(a.hold || 300), await page.keyboard.up(a.key)
  if (a.wait) await page.waitForTimeout(a.wait)
  if (a.eval) console.log('eval:', JSON.stringify(await page.evaluate(a.eval)))
}
await page.screenshot({ path: out })
console.log(logs.length ? logs.slice(0, 20).join('\n') : 'no console errors/warnings')
await browser.close()
