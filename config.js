// Конфигурация подключения к Supabase
const SUPABASE_URL = 'https://jkoxvjaxjljijhiztmlb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb3h2amF4amxqaWpoaXp0bWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4ODA3NzcsImV4cCI6MjA1MDQ1Njc3N30.PEm1iG4mppgoB3CjBtBN3y2iqtOfWYfY091o1TJ9-nA';

// Глобальная переменная для хранения клиента Supabase
let supabaseInstance = null;

// Функция инициализации Supabase
function initializeSupabase() {
    try {
        // Если клиент уже создан, возвращаем его
        if (supabaseInstance !== null) {
            return supabaseInstance;
        }
        
        // Проверка наличия библиотеки Supabase
        if (typeof supabaseClient !== 'undefined') {
            // Используем глобальный объект supabaseClient
            supabaseInstance = supabaseClient.createClient(SUPABASE_URL, SUPABASE_KEY);
            return supabaseInstance;
        } else if (typeof window !== 'undefined' && window.supabase) {
            // Используем глобальный объект window.supabase (браузер)
            supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            return supabaseInstance;
        } else if (typeof require !== 'undefined') {
            // Node.js окружение
            const { createClient } = require('@supabase/supabase-js');
            supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
            return supabaseInstance;
        } else {
            throw new Error('Библиотека Supabase не загружена. Убедитесь, что скрипт Supabase добавлен перед config.js');
        }
    } catch (err) {
        console.error('Ошибка при инициализации Supabase:', err);
        throw err;
    }
}

// Экспортируем функцию для использования в других файлах
if (typeof module !== 'undefined') {
    module.exports = { initializeSupabase };
}