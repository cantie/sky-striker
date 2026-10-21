import { describe, expect, it } from 'vitest'
import { loadArtEnv, requireKeys } from './env.mjs'

const file = (text) => () => text

describe('art env', () => {
  it('reads KEY=value lines and ignores comments and blanks', () => {
    const env = loadArtEnv({ home: '/h', env: {}, readFile: file('# x\nZPS3D_API=https://a\n\nIMAGE_KEY=k=v\r\n') })
    expect(env).toEqual({ ZPS3D_API: 'https://a', IMAGE_KEY: 'k=v' })
  })

  it('the environment overrides the file', () => {
    const env = loadArtEnv({ home: '/h', env: { ZPS3D_KEY: 'b' }, readFile: file('ZPS3D_KEY=a\n') })
    expect(env.ZPS3D_KEY).toBe('b')
  })

  it('a missing file is not an error', () => {
    const readFile = () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }) }
    expect(loadArtEnv({ home: '/h', env: {}, readFile })).toEqual({})
  })

  it('requireKeys names the missing keys and the file', () => {
    let message = ''
    try { requireKeys({ ZPS3D_API: 'x' }, ['ZPS3D_API', 'ZPS3D_KEY']) } catch (e) { message = e.message }
    expect(message).toMatch(/ZPS3D_KEY/)
    expect(message).toMatch(/~\/\.config\/sky-striker\/assets\.env/)
    expect(message).not.toMatch(/ZPS3D_API,/)
  })
})
