var SUPABASE_URL = 'https://jkoxvjaxjljijhiztmlb.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb3h2amF4amxqaWpoaXp0bWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4ODA3NzcsImV4cCI6MjA1MDQ1Njc3N30.PEm1iG4mppgoB3CjBtBN3y2iqtOfWYfY091o1TJ9-nA';

// Создаем глобальный клиент supabase
try {
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        realtime: {
            params: {
                eventsPerSecond: 2
            }
        }
    });
} catch (error) {
    console.error('Помилка ініціалізації Supabase:', error);
    alert('Помилка підключення до бази даних. Будь ласка, оновіть сторінку.');
}

// Проверяем что клиент создан и инициализирован правильно
if (!supabase || !supabase.auth) {
    console.error('Не удалось инициализировать Supabase клиент');
    console.log('URL:', SUPABASE_URL);
    console.log('Key length:', SUPABASE_ANON_KEY.length);
}