// Добавляем переменную для хранения экземпляра графика
let currentChart = null;
let currentCoatuuChart = null;
let allCoatuuValues = []; // Добавляем переменную для хранения всех уникальных значений

async function loadDashboardData(namecoatuuFilter = '') {
    document.body.classList.add('loading');
    try {
        console.log('Запит даних для дашборду...');
        
        // Отримуємо загальну кількість записів
        const { count, error: countError } = await supabase
            .from('parcel')
            .select('id', { count: 'exact', head: true });
        
        if (countError) {
            console.error('Помилка отримання кількості записів:', countError);
            throw countError;
        }
            
        console.log('Загальна кількість записів:', count);

        // Отримуємо всі дані за допомогою пагінації
        let allData = [];
        const pageSize = 1000;
        let page = 0;
        
        while (page * pageSize < count) {
            let query = supabase
                .rpc('get_parcels_with_coatuu')
                .range(page * pageSize, (page + 1) * pageSize - 1);
                
            if (namecoatuuFilter && namecoatuuFilter !== '') {
                query = query.eq('namecoatuu', namecoatuuFilter);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('Помилка отримання даних:', error);
                throw error;
            }
            if (!data || data.length === 0) break;
            
            allData = allData.concat(data);
            page++;
        }
        
        console.log('Отримано всього записів:', allData.length);

        if (!allData.length) {
            console.log('Дані відсутні');
            document.querySelector('#totalParcels .stat-number').textContent = '0';
            document.querySelector('#totalArea .stat-number').textContent = '0 га';
            document.querySelector('#avgArea .stat-number').textContent = '0 га';
            return;
        }

        // Обчислюємо статистику по всім даним
        const totalArea = allData.reduce((sum, parcel) => {
            const areaNum = parseFloat(parcel.area) || 0;
            return sum + areaNum;
        }, 0);
        
        const avgArea = totalArea / allData.length;

        // Оновлюємо відображення
        document.querySelector('#totalParcels .stat-number').textContent = allData.length;
        document.querySelector('#totalArea .stat-number').textContent = `${totalArea.toFixed(2)} га`;
        document.querySelector('#avgArea .stat-number').textContent = `${avgArea.toFixed(2)} га`;

        // Створюємо графік розподілу площ
        createAreaChart(allData);

        // Створюємо графік розподілу по namecoatuu
        createCoatuuChart(allData);

        // Отображаем уникальные значения namecoatuu
        displayUniqueCoatuu(allData);

        // Заполняем выпадающий список после загрузки данных
        if (!allCoatuuValues.length) {
            populateCoatuuDropdown(allData);
        }

    } catch (error) {
        console.error('Детальна помилка завантаження:', error);
        console.error('Стек помилки:', error.stack);
        alert(`Помилка завантаження даних: ${error.message}`);
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

    const ctx = document.getElementById('areaChart').getContext('2d');
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

function createCoatuuChart(data) {
    const coatuuCounts = {};

    data.forEach(parcel => {
        const namecoatuu = parcel.namecoatuu || 'Невідомо';
        if (!coatuuCounts[namecoatuu]) {
            coatuuCounts[namecoatuu] = 0;
        }
        coatuuCounts[namecoatuu]++;
    });

    // Уничтожаем предыдущий график если он существует
    if (currentCoatuuChart) {
        currentCoatuuChart.destroy();
    }

    const ctx = document.getElementById('coatuuChart').getContext('2d');
    currentCoatuuChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(coatuuCounts),
            datasets: [{
                label: 'Кількість ділянок',
                data: Object.values(coatuuCounts),
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Розподіл ділянок за Сільською радою'
                }
            }
        }
    });
}

function displayUniqueCoatuu(data) {
    const uniqueCoatuu = [...new Set(data.map(item => item.namecoatuu))];
    console.log('Унікальні значення namecoatuu:', uniqueCoatuu); // Добавляем вывод в консоль для отладки
    const uniqueCoatuuList = document.getElementById('uniqueCoatuuList');
    uniqueCoatuuList.innerHTML = ''; // Очищаем список перед добавлением новых данных

    uniqueCoatuu.forEach(namecoatuu => {
        const listItem = document.createElement('li');
        listItem.textContent = namecoatuu;
        uniqueCoatuuList.appendChild(listItem);
    });
}

function populateCoatuuDropdown(data) {
    const dropdown = document.getElementById('coatuuDropdown');
    dropdown.innerHTML = '<option value="">Всі Сільські ради</option>'; // Очищаем и добавляем опцию по умолчанию
    allCoatuuValues = [...new Set(data.map(item => item.namecoatuu))];
    console.log('Унікальні значення для випадаючого списку:', allCoatuuValues); // Добавляем вывод в консоль для отладки
    allCoatuuValues.forEach(namecoatuu => {
        const option = document.createElement('option');
        option.value = namecoatuu;
        option.textContent = namecoatuu;
        dropdown.appendChild(option);
    });
}

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    const authSection = document.getElementById('auth-section');
    const mainContent = document.getElementById('main-content');
    const userEmailElement = document.getElementById('userEmail');
    
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
supabase.auth.onAuthStateChange((event, session) => {
    checkAuth();
});

// Оновлюємо ініціалізацію
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

async function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        console.log('Успішний вхід:', data);
        checkAuth(); // Перепроверяем авторизацию и показываем дашборд
    } catch (error) {
        console.error('Помилка входу:', error);
        alert(`Помилка входу: ${error.message}`);
    }
}

async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.reload(); // Перезавантажуємо сторінку після виходу
    } catch (error) {
        console.error('Помилка виходу:', error);
        alert(`Помилка виходу: ${error.message}`);
    }
}

document.getElementById('coatuuDropdown').addEventListener('change', (event) => {
    const selectedValue = event.target.value;
    loadDashboardData(selectedValue);
});
