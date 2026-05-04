import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are missing")
}

console.log("Supabase URL:", supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
