import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  // VITE_* values enter browser assets. Stop BEFORE bundling a privileged key.
  if (key && !key.startsWith('sb_publishable_')) {
    let role = ''
    try { role = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role } catch {}
    if (role !== 'anon') throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a public publishable or anon key; never a server secret.')
  }
  return {
  plugins: [vue()],
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  build: { sourcemap: true }
  }
})
