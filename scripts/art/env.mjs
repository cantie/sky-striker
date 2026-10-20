// Keys and endpoints for the art pipeline. They live outside the repo (the repo is public).
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const ART_ENV_FILE = '~/.config/sky-striker/assets.env'
const KEYS = ['HY3D_API', 'HY3D_KEY', 'IMAGE_API', 'IMAGE_MODEL', 'IMAGE_KEY']

/** KEY=value lines from ~/.config/sky-striker/assets.env, overridden by the environment. */
export function loadArtEnv({ home = homedir(), env = process.env, readFile = readFileSync } = {}) {
  let text = ''
  try { text = readFile(join(home, '.config', 'sky-striker', 'assets.env'), 'utf8') } catch { /* no file: env only */ }
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (!/^\w+=/.test(line)) continue
    const at = line.indexOf('=')
    out[line.slice(0, at)] = line.slice(at + 1)
  }
  for (const k of KEYS) if (env[k]) out[k] = env[k]
  return out
}

export function requireKeys(env, keys) {
  const missing = keys.filter((k) => !env[k])
  if (missing.length) {
    throw new Error(`Missing ${missing.join(', ')}: put them in ${ART_ENV_FILE} ` +
      '(see docs/superpowers/specs/2026-10-20-reskin-aircraft-design.md, "Setup on another machine")')
  }
}
