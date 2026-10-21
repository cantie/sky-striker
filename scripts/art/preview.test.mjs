import { describe, expect, it } from 'vitest'
import { browserOptions, previewUrl } from './preview.mjs'

describe('previewUrl', () => {
  it('lists the ids in manifest order', () => {
    const assets = [{ id: 'player-hawk' }, { id: 'enemy-basic-s1' }, { id: 'boss-vulture' }]
    expect(previewUrl('http://localhost:5847', assets)).toBe('http://localhost:5847/art-preview.html?ids=player-hawk,enemy-basic-s1,boss-vulture')
  })
})

describe('the headless browser', () => {
  const win = 'C:/Users/me/AppData/Local'
  const shell = `${win}/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe`

  it('uses the Windows headless shell where it is installed', () => {
    expect(browserOptions({ LOCALAPPDATA: win }, (p) => p === shell).executablePath).toBe(shell)
  })

  it("elsewhere (another machine, macOS, Linux) lets Playwright pick its own Chromium", () => {
    expect(browserOptions({}, () => true).executablePath).toBeUndefined()
    expect(browserOptions({ LOCALAPPDATA: win }, () => false).executablePath).toBeUndefined()
    expect(browserOptions({}, () => true).args).toContain('--use-angle=swiftshader')
  })
})
