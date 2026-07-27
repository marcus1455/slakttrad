import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Saknar VITE_SUPABASE_URL eller VITE_SUPABASE_ANON_KEY i .env')
}

export const supabase = createClient(url, anonKey)

export const DEFAULT_TREE_SLUG = 'davidsson'
