import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function bundleText(path) {
  return readdirSync(path).map(entry => {
    const absolute = join(path, entry)
    return statSync(absolute).isDirectory() ? bundleText(absolute) : readFileSync(absolute, 'utf8')
  }).join('\n')
}

const assets = bundleText('dist')
if (!assets.includes('xzeshoksqfmxehrwijqo.supabase.co')) {
  throw new Error('The production bundle has no configured LiftCycle Supabase URL.')
}
if (!assets.includes('Sync LiftCycle across your devices')) {
  throw new Error('The production bundle is missing the sign-in UI.')
}
console.log('Cloud configuration and sign-in UI are included in the production bundle.')
