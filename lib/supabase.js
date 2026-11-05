import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmunmbypitgtjpkquoqw.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdW5tYnlwaXRndGpwa3F1b3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzIwMTksImV4cCI6MjEwMzI0ODAxOX0.HZiOQwgwkpvnBun-qoTAUijq8nPb9OGF-LVFcppmJ6I'

if (!supabaseUrl) {
  console.error('Missing Supabase URL')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})

export const MOCK_PROFILES = [
  {
    id: '1',
    full_name: 'Elena',
    age: 24,
    city: 'Accra',
    bio: 'Love ceramic art',
    intent: 'Long-term Relationship',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80'
  }
]

export const getAuthenticatedUser = async () => {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user || null
  } catch {
    return null
  }
}
