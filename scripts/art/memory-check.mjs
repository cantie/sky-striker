// npm run art:memory (with npm run dev up): plays into stages 1-4 and checks the GPU texture count does
// not keep growing, i.e. a finished stage's AI models are freed.
import { DEV_URL, devServerUp, launchBrowser } from './preview.mjs'

/** Stage 4 may hold a few more textures than the larger of stages 1 and 2, not a pile of old ones. */
const SLACK = 8
const memoryOk = ([s1, s2, , s4]) => s4 <= Math.max(s1, s2) + SLACK

async function main() {
  if (!(await devServerUp())) return false
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } })
    await page.goto(DEV_URL, { waitUntil: 'load' })
    await page.waitForFunction(() => !!window.__store && !!window.__renderer, null, { timeout: 30_000 })
    const counts = []
    for (const stageId of [1, 2, 3, 4]) {
      await page.evaluate((id) => {
        const st = window.__store
        st.getState().selectStage(id)
        st.getState().startGame({ stageId: id })
      }, stageId)
      await page.waitForTimeout(5000)
      counts.push(await page.evaluate(() => window.__renderer.info.memory.textures))
    }
    const ok = memoryOk(counts)
    console.log(`textures by stage 1-4: ${counts.join(', ')} → ${ok ? 'pass' : `fail (stage 4 > max(stage 1, stage 2) + ${SLACK})`}`)
    return ok
  } finally {
    await browser.close()
  }
}

main().then((ok) => { process.exitCode = ok ? 0 : 1 }, (e) => { console.error(e.message); process.exitCode = 1 })
