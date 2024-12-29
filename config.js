const SUPABASE_URL = 'https://jkoxvjaxjljijhiztmlb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb3h2amF4amxqaWpoaXp0bWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4ODA3NzcsImV4cCI6MjA1MDQ1Njc3N30.PEm1iG4mppgoB3CjBtBN3y2iqtOfWYfY091o1TJ9-nA'

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true
    },
    db: {
        schema: 'public'
    }
})