import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// A focused commit guard, not a replacement for reviewing new integrations.
const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const failures = []
const publicKeys = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])
for (const path of paths) {
  if (/(^|\/)(private|credentials|\.vercel)\/|\.(pem|key)$|(^|\/)(liftcycle-|homebase-|rhythm-).*\.json$|backup.*\.json$/i.test(path)) failures.push(`${path}: private file must not be tracked`)
  if (/(^|\/)\.env/.test(path) && !['.env.example', '.env.production'].includes(path)) failures.push(`${path}: only public configuration templates may be tracked`)
  const content = readFileSync(path, 'utf8')
  if (path === '.env.production') for (const line of content.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue
    if (!publicKeys.has(line.split('=')[0].trim())) failures.push(`${path}: non-allowlisted environment variable`)
  }
  if (/sb_secret_[A-Za-z0-9_-]{8,}|(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) failures.push(`${path}: potential secret`)
  for (const token of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(token[1], 'base64url').toString()).role !== 'anon') failures.push(`${path}: non-public JWT`) } catch { failures.push(`${path}: unrecognized JWT`) }
  }
}
if (failures.length) {
  console.error([...new Set(failures)].join('\n'))
  process.exit(1)
}
console.log('Tracked files contain no recognized secrets or private exports; committed environment config is public-only.')
