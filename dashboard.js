// Добавляем переменную для хранения экземпляра графика
let currentChart = null;
let currentCoatuuChart = null;
let allCoatuuValues = []; // Добавляем переменную для хранения всех уникальных значений

// Добавляем функцию для повторных попыток запроса
async function fetchWithRetry(fetchFunction, maxRetries = 3, delayMs = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fetchFunction();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.log(`Спроба ${i + 1} не вдалася, очікування ${delayMs}мс...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

// Обновляем функцию загрузки данных
async function loadDashboardData(namecoatuuFilter = '') {
    document.body.classList.add('loading');
    try {
        // Проверяем подключение к Supabase
        if (!supabase || !supabase.auth) {
            throw new Error('Відсутнє підключення до бази даних. Оновіть сторінку.');
        }

        // Используем fetchWithRetry для запроса
        const { count, error: countError } = await fetchWithRetry(async () => 
            await supabase
                .from('parcel')
                .select('id', { count: 'exact', head: true })
        );

        if (countError) {
            if (countError.code === 'P0001') {
                alert('У вас немає прав доступу до даних. Будь ласка, зверніться до адміністратора системи.');
            }
            throw countError;
        }

        // Отримуємо всі дані за допомогою пагінації
        let allData = [];
        const pageSize = 1000;
        let page = 0;
        
        while (page * pageSize < count) {
            // Используем fetchWithRetry для каждой страницы
            const { data, error } = await fetchWithRetry(async () => {
                let query = supabase
                    .rpc('get_parcels_with_coatuu')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (namecoatuuFilter && namecoatuuFilter !== '') {
                    query = query.eq('namecoatuu', namecoatuuFilter);
                }
                
                return await query;
            });

            if (error) {
                if (error.code === 'P0001') {
                    alert('У вас немає прав доступу до даних. Будь ласка, зверніться до адміністратора системи.');
                }
                throw error;
            }
            if (!data || data.length === 0) break;
            
            allData = allData.concat(data);
            page++;
        }

        if (!allData.length) {
            const totalParcelsEl = document.querySelector('#totalParcels .stat-number');
            const totalAreaEl = document.querySelector('#totalArea .stat-number');
            const avgAreaEl = document.querySelector('#avgArea .stat-number');

            if (totalParcelsEl && totalAreaEl && avgAreaEl) {
                totalParcelsEl.textContent = '0';
                totalAreaEl.textContent = '0 га';
                avgAreaEl.textContent = '0 га';
            }
            return;
        }

        // Обчислюємо статистику по всім даним
        const totalArea = allData.reduce((sum, parcel) => {
            const areaNum = parseFloat(parcel.area) || 0;
            return sum + areaNum;
        }, 0);
        
        const avgArea = totalArea / allData.length;

        // Перед обновлением значений проверяем, что селекторы не возвращают null
        const totalParcelsEl = document.querySelector('#totalParcels .stat-number');
        const totalAreaEl = document.querySelector('#totalArea .stat-number');
        const avgAreaEl = document.querySelector('#avgArea .stat-number');

        if (totalParcelsEl && totalAreaEl && avgAreaEl) {
            totalParcelsEl.textContent = allData.length;
            totalAreaEl.textContent = `${totalArea.toFixed(2)} га`;
            avgAreaEl.textContent = `${avgArea.toFixed(2)} га`;
        }

        // Створюємо графік розподілу площ
        createAreaChart(allData);

        // Заполняем выпадающий список после загрузки данных
        if (!allCoatuuValues.length) {
            populateCoatuuDropdown(allData);
        }

    } catch (error) {
        console.error('Детальна помилка завантаження:', error.message);
        console.error('Стек помилки:', {
            message: error.message,
            details: error.stack,
            hint: error.hint || '',
            code: error.code || ''
        });
        
        // Показываем более информативное сообщение пользователю
        if (error.message.includes('Failed to fetch')) {
            alert('Помилка підключення до сервера. Перевірте інтернет-з\'єднання та оновіть сторінку.');
        } else {
            alert(`Помилка завантаження даних: ${error.message}`);
        }
    } finally {
        document.body.classList.remove('loading');
    }
}

function createAreaChart(data) {
    const areaRanges = {
        '0-1': 0,
        '1-2': 0,
        '2-5': 0,
        '5+': 0
    };

    data.forEach(parcel => {
        // Перетворюємо значення в число
        const area = parseFloat(parcel.area) || 0;
        
        if (area <= 1) areaRanges['0-1']++;
        else if (area <= 2) areaRanges['1-2']++;
        else if (area <= 5) areaRanges['2-5']++;
        else areaRanges['5+']++;
    });

    // Уничтожаем предыдущий график если он существует
    if (currentChart) {
        currentChart.destroy();
    }

    const canvas = document.getElementById('areaChart');
    if (!canvas) {
        console.warn('Элемент canvas для графика не найден.');
        return;
    }

    const ctx = canvas.getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(areaRanges),
            datasets: [{
                label: 'Кількість ділянок',
                data: Object.values(areaRanges),
                backgroundColor: '#3ECF8E'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Розподіл ділянок за площею (га)'
                }
            }
        }
    });
}

function populateCoatuuDropdown(data) {
    const dropdown = document.getElementById('coatuuDropdown');
    dropdown.innerHTML = '<option value="">Всі ради</option>'; // Очищаем и добавляем опцию по умолчанию
    allCoatuuValues = [...new Set(data.map(item => item.namecoatuu))];
    allCoatuuValues.forEach(namecoatuu => {
        const option = document.createElement('option');
        option.value = namecoatuu;
        option.textContent = namecoatuu;
        dropdown.appendChild(option);
    });
}

async function checkAuth() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase не инициализирован. Проверьте порядок подключения config.js');
        return;
    }
    if (!supabase || !supabase.auth || !supabase.auth.getSession) {
        console.error('Supabase auth is не настроен или отсутствует.');
        return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const authSection = document.getElementById('auth-section');
    const mainContent = document.getElementById('main-content');
    const userEmailElement = document.getElementById('userEmail'); // Добавляем получение элемента

    if (!authSection || !mainContent) {
        console.warn('Элементы auth-section или main-content отсутствуют на этой странице.');
        return;
    }

    if (session) {
        authSection.style.display = 'none';
        mainContent.style.display = 'block';
        // Показуємо email користувача
        if (userEmailElement && session.user) {
            userEmailElement.textContent = session.user.email;
        }
        loadDashboardData();
    } else {
        authSection.style.display = 'block';
        mainContent.style.display = 'none';
    }
}

// Додаємо слухач для змін аутентифікації
if (supabase && supabase.auth && supabase.auth.onAuthStateChange) {
    supabase.auth.onAuthStateChange((event, session) => {
        checkAuth();
    });
}

// Функция для проверки готовности supabase
function waitForSupabase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const checkSupabase = () => {
            if (window.supabase && supabase.auth) {
                resolve();
            } else if (attempts > 10) {
                reject(new Error('Supabase не инициализирован'));
            } else {
                attempts++;
                setTimeout(checkSupabase, 100);
            }
        };
        checkSupabase();
    });
}

// Исправляем блок try в инициализации
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await waitForSupabase();
        await checkAuth();
        
        // Додаємо періодичне оновлення віку кешу
        updateCacheAge();
        setInterval(updateCacheAge, 60000);
        
        // Додаємо обробник для випадаючого списку
        const coatuuDropdown = document.getElementById('coatuuDropdown');
        if (coatuuDropdown) {
            coatuuDropdown.addEventListener('change', (event) => {
                loadDashboardData(event.target.value);
            });
        }
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        alert('Ошибка инициализации приложения. Попробуйте перезагрузить страницу.');
    }
});

// Додаємо функцію для оновлення віку кешу (якщо її ще немає)
function updateCacheAge() {
    const cacheAgeElement = document.getElementById('cacheAge');
    if (cacheAgeElement) {
        const age = cacheManager.getCacheAge('parcels');
        cacheAgeElement.textContent = age ? `Вік кешу: ${age} год` : 'Кеш пустий';
    }
}

// Делаем функцию входа глобальной
window.signIn = async function() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!supabase || !supabase.auth || !supabase.auth.signInWithPassword) {
        alert('Сервіс аутентифікації недоступний.');
        return;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        checkAuth();
    } catch (error) {
        console.error('Помилка входу:', error);
        alert(`Помилка входу: ${error.message}`);
    }
};

// Также делаем глобальной функцию выхода
window.signOut = async function() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.reload();
    } catch (error) {
        console.error('Помилка виходу:', error);
        alert(`Помилка виходу: ${error.message}`);
    }
};
