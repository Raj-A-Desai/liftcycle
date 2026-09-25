import { createClient } from '@supabase/supabase-js'

// These are the public URL and publishable key for the dedicated LiftCycle project.
// They are safe to ship to the browser: row-level security protects user data.
// Runtime/build-time environment variables may override them for another project.
// Never use a Supabase service-role or secret key here.
const DEFAULT_URL = 'https://xzeshoksqfmxehrwijqo.supabase.co'
const DEFAULT_PUBLIC_KEY = 'sb_publishable_NcIO4TKAqpRprVqBbZZhcA_AjvA1vr4'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || DEFAULT_URL
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || DEFAULT_PUBLIC_KEY

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const cloudConfigured = true
