// Step preview: a screenshot of the batch from the game camera (art-preview.html on the dev server).
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { artPaths } from './paths.mjs'

export const DEV_URL = 'http://localhost:5847'

export const previewUrl = (base, assets) => `${base}/art-preview.html?ids=${assets.map((a) => a.id).join(',')}`

/**
 * Launch options for headless Chromium with software GL, so it works without a GPU: the Windows headless
 * shell the playtest bot uses where it is installed, otherwise whatever Chromium Playwright installed.
 */
export function browserOptions(env = process.env, exists = existsSync) {
  const shell = env.LOCALAPPDATA && `${env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe`
  return {
    ...(shell && exists(shell) ? { executablePath: shell } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  }
}

export async function launchBrowser() {
  const { chromium } = await import('playwright')
  return chromium.launch(browserOptions())
}

/** False (and a hint printed) when nothing answers on the dev server port. */
export async function devServerUp(base = DEV_URL, log = console.error) {
  try { await fetch(base, { signal: AbortSignal.timeout(3000) }); return true } catch {
    log('Start npm run dev first')
    return false
  }
}

export async function runPreview(assets, { paths = artPaths(), log = console.log } = {}) {
  if (!assets.length) return { ok: [], failed: [], blocked: [] }
  if (!(await devServerUp())) return { ok: [], failed: [{ id: 'preview', error: 'dev server not running' }], blocked: [] }
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } })
    await page.goto(previewUrl(DEV_URL, assets), { waitUntil: 'load' })
    await page.waitForFunction(() => window.__previewReady === true, null, { timeout: 60_000 })
    const errors = await page.evaluate(() => window.__previewErrors ?? [])
    const out = paths.preview(assets[0].batch)
    mkdirSync(dirname(out), { recursive: true })
    await page.screenshot({ path: out, fullPage: true })
    log(`preview: ${out}`)
    const failed = errors.map((e) => ({ id: e.split(':')[0], error: e }))
    return { ok: assets.filter((a) => !failed.some((f) => f.id === a.id)).map((a) => a.id), failed, blocked: [] }
  } finally {
    await browser.close()
  }
}
