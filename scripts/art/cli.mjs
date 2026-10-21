// npm run art -- <step> <batch|ids> [--force] [--n N]
//   concept <sel>        draw concept drafts and a review page
//   approve <id> <k>     keep draft k as the approved concept
//   model <sel>          approved concepts → raw GLBs (ZPS 3D)
//   build <sel>          raw GLBs → public/models/ai
//   preview <sel>        screenshots from the game camera (needs npm run dev)
import { ASSETS, BUDGETS } from '../../art/manifest.mjs'
import { loadArtEnv } from './env.mjs'
import { selectAssets, validateManifest } from './manifest.mjs'
import { runPreview } from './preview.mjs'
import { runApprove, runBuild, runConcept, runModel } from './steps.mjs'

const args = process.argv.slice(2)
const flags = { force: args.includes('--force'), n: undefined }
const nAt = args.indexOf('--n')
if (nAt >= 0) flags.n = Number(args[nAt + 1])
const [step, ...rest] = args.filter((a, i) => !a.startsWith('--') && !(nAt >= 0 && i === nAt + 1))

/** Prints the summary; true when everything went through. */
function report({ ok = [], failed = [], blocked = [] }) {
  console.log(`ok ${ok.length}, failed ${failed.length}, blocked ${blocked.length}`)
  for (const f of failed) console.log(`  failed ${f.id}: ${f.error}`)
  for (const b of blocked) console.log(`  blocked ${b.id}: ${b.reason}`)
  return failed.length === 0 && blocked.length === 0
}

async function main() {
  const problems = validateManifest(ASSETS, BUDGETS)
  if (problems.length) {
    console.error(`art/manifest.mjs has problems:\n  ${problems.join('\n  ')}`)
    return false
  }
  const env = loadArtEnv()
  const pick = () => {
    if (!rest[0]) throw new Error(`Usage: npm run art -- ${step} <batch|ids>`)
    return selectAssets(ASSETS, rest[0])
  }
  switch (step) {
    case 'concept': return report(await runConcept(pick(), { env, force: flags.force, n: flags.n }))
    case 'approve': {
      if (!rest[0] || !rest[1]) throw new Error('Usage: npm run art -- approve <id> <draft number>')
      await runApprove(rest[0], Number(rest[1]))
      return true
    }
    case 'model': return report(await runModel(pick(), { env, force: flags.force }))
    case 'build': return report(await runBuild(pick()))
    case 'preview': return report(await runPreview(pick()))
    default:
      console.error('Usage: npm run art -- <concept|approve|model|build|preview> <batch|ids> [--force] [--n N]')
      return false
  }
}

main().then((ok) => { process.exitCode = ok ? 0 : 1 }, (e) => { console.error(e.message); process.exitCode = 1 })
