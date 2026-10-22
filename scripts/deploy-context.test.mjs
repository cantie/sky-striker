// The image's game build (`npm run build`: tsc over all of src, then vite) sees only what the Dockerfile's
// client stage copies, from what export-deploy.ps1 puts in the upload zip. Anything src imports from
// outside src (the art manifest's types, read by a dev page and a test) has to be in both, or the deploy
// fails while every local build passes.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')
const rel = (p) => relative(ROOT, p).split(sep).join('/')

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name)
    return d.isDirectory() ? walk(p) : /\.(ts|tsx|mts)$/.test(d.name) ? [p] : []
  })
}

/** Relative imports. A Vite query import (`?raw`) is typed by vite/client and needs no file to type-check. */
const importsOf = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"?]+)['"]/g)].map((m) => resolve(dirname(file), m[1]))

/** The file tsc reads for an import: a `.mjs` with a `.d.mts` beside it is read through its declarations. */
function typeFile(target) {
  const decl = target.replace(/\.mjs$/, '.d.mts')
  return decl !== target && existsSync(decl) ? decl : target
}

/** Files outside src that the game build reads, following the imports of those files too. */
function outsideSrc() {
  const need = new Set(), queue = walk(SRC)
  const seen = new Set(queue)
  while (queue.length) {
    for (const target of importsOf(queue.pop())) {
      const file = typeFile(target)
      if (file.startsWith(SRC + sep) || seen.has(file)) continue
      seen.add(file)
      need.add(rel(file))
      if (/\.(d\.mts|ts|mts)$/.test(file)) queue.push(file)
    }
  }
  return [...need].sort()
}

/** Sources of the client stage's COPY lines. */
function clientCopies() {
  let stage = ''
  const out = []
  for (const line of readFileSync(join(ROOT, 'Dockerfile'), 'utf8').split(/\r?\n/)) {
    const from = line.match(/^FROM\s+\S+(?:\s+AS\s+(\S+))?/i)
    if (from) stage = from[1] ?? ''
    const copy = line.match(/^COPY\s+(?!--)(.+)$/i)
    if (stage === 'client' && copy) out.push(...copy[1].trim().split(/\s+/).slice(0, -1))
  }
  return out
}

/** The paths export-deploy.ps1 packs. */
function zipIncludes() {
  const block = readFileSync(join(ROOT, 'scripts/export-deploy.ps1'), 'utf8').match(/\$include = @\(([\s\S]*?)\)/)
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

const covered = (file, sources) => sources.some((s) => file === s || file.startsWith(s.replace(/\/$/, '') + '/'))

describe('deploy context', () => {
  it('src reaches outside src only for the art types (keep this list short)', () => {
    expect(outsideSrc()).toEqual(['art/manifest.d.mts', 'scripts/art/checks.d.mts'])
  })

  it('the Dockerfile client stage copies every file outside src that the game build reads', () => {
    const copies = clientCopies()
    for (const f of outsideSrc()) expect(covered(f, copies), f).toBe(true)
  })

  it('the upload zip carries them too', () => {
    const packed = zipIncludes()
    for (const f of outsideSrc()) expect(covered(f, packed), f).toBe(true)
  })
})
