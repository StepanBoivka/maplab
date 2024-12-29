let map;
let parcelsLayer;
let currentBaseLayer;
let allCoatuuValues = []; // Добавляем переменную для хранения всех уникальных значений

const basemaps = {
    satellite: L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google'
    }),
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    })
};

function initMap() {
    map = L.map('map').setView([48.86, 24.62], 13);
    
    // Устанавливаем спутник по умолчанию
    currentBaseLayer = basemaps.satellite;
    currentBaseLayer.addTo(map);
    
    parcelsLayer = L.geoJSON(null, {
        style: {
            color: '#3ECF8E',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.2
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties) {
                layer.bindPopup(`
                    <strong>Ділянка: ${feature.properties.cadnum}</strong><br>
                    Площа: ${feature.properties.area} га
                `);
            }
        }
    }).addTo(map);
}

function switchBaseMap(type) {
    // Удаляем текущий слой
    if (currentBaseLayer) {
        map.removeLayer(currentBaseLayer);
    }
    
    // Добавляем новый слой
    currentBaseLayer = basemaps[type];
    currentBaseLayer.addTo(map);
    
    // Обновляем активные кнопки
    document.querySelectorAll('.map-switch').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${type}-btn`).classList.add('active');
}

function wktToGeoJSON(wkt, properties = {}) {
    const wicket = new Wkt.Wkt();
    try {
        wicket.read(wkt);
        const geojson = wicket.toJson();
        return {
            type: "Feature",
            geometry: geojson,
            properties: properties
        };
    } catch (e) {
        console.error('Помилка конвертації WKT:', e);
        return null;
    }
}

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
        fetchData(); // Обновляем данные после входа
    } catch (error) {
        console.error('Помилка входу:', error);
        alert(`Помилка входу: ${error.message}`);
    }
}

async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;
        
        alert('Перевірте email для підтвердження реєстрації');
    } catch (error) {
        console.error('Помилка реєстрації:', error);
        alert(`Помилка реєстрації: ${error.message}`);
    }
}

async function signInWithMagicLink() {
    const email = document.getElementById('email').value;
    if (!email) {
        alert('Будь ласка, введіть email');
        return;
    }
    
    try {
        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: window.location.origin,
            },
        });
        
        if (error) throw error;
        
        alert('Перевірте вашу пошту для входу!');
    } catch (error) {
        console.error('Помилка відправки Magic Link:', error);
        alert(`Помилка: ${error.message}`);
    }
}

// Обновляем функцию проверки сессии
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        console.log('Активна сесія:', session);
        document.getElementById('auth-section').style.display = 'none';
        // Показываем информацию о пользователе
        const userEmail = session.user?.email;
        if (userEmail) {
            document.getElementById('data').innerHTML = `Ви увійшли як: ${userEmail}`;
        }
    }
}

let currentPage = 0;
const pageSize = 10;

async function loadAllParcelsToMap(cadnum = '', namecoatuuFilters = []) {
    try {
        console.log('Запит даних для карти...');
        
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
                
            if (cadnum) {
                query = query.ilike('cadnum', `%${cadnum}%`);
            }
            
            if (Array.isArray(namecoatuuFilters) && namecoatuuFilters.length > 0) {
                query = query.in('namecoatuu', namecoatuuFilters);
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
            return;
        }

        // Очищаем слой с участками
        parcelsLayer.clearLayers();
        
        // Выводим первую запись для анализа структуры
        console.log('Приклад запису:', allData[0]);
        
        // Добавляем все участки на карту
        let hasValidBounds = false;
        const bounds = L.latLngBounds([]);
        
        allData.forEach(parcel => {
            try {
                if (!parcel.geom) {
                    console.log('Відсутня геометрія для ділянки:', parcel);
                    return;
                }

                const geojson = {
                    type: "Feature",
                    geometry: typeof parcel.geom === 'string' ? JSON.parse(parcel.geom) : parcel.geom,
                    properties: {
                        cadnum: parcel.cadnum,
                        area: parcel.area,
                        area_service: parcel.area_service,
                        namecoatuu: parcel.namecoatuu // Исправляем имя столбца
                    }
                };
                
                console.log('Створений GeoJSON:', geojson);
                
                parcelsLayer.addData(geojson);
                const layer = parcelsLayer.getLayers()[parcelsLayer.getLayers().length - 1];
                if (layer && layer.getBounds) {
                    bounds.extend(layer.getBounds());
                    hasValidBounds = true;
                }
            } catch (e) {
                console.error('Помилка обробки геометрії:', e, parcel);
            }
        });
        
        if (hasValidBounds) {
            map.fitBounds(bounds);
        }

        // Заполняем выпадающий список после загрузки данных
        if (!allCoatuuValues.length) {
            populateCoatuuDropdown(allData);
        }
        
    } catch (error) {
        console.error('Детальна помилка завантаження:', error);
        console.error('Стек помилки:', error.stack);
        alert('Помилка завантаження даних. Перевірте консоль для деталей.');
    }
}

async function searchParcels() {
    handleSearch();
}

// Добавляем функции для работы с модальным окном
function showModal(id, cadnum, area, note) {
    document.getElementById('editModal').style.display = 'block';
    document.getElementById('editParcelId').value = id;
    document.getElementById('editCadnum').value = cadnum;
    document.getElementById('editArea').value = area;
    document.getElementById('editNote').value = note;
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function updateParcel(event) {
    event.preventDefault();
    
    const id = document.getElementById('editParcelId').value;
    const area = document.getElementById('editArea').value;
    
    try {
        const { data, error, status } = await supabase
            .from('parcel')
            .update({
                area: parseFloat(area)
            })
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        
        if (data) {
            const layer = findLayerByCadnum(data.cadnum);
            if (layer) {
                layer.setPopupContent(`
                    <strong>Ділянка: ${data.cadnum}</strong><br>
                    Площа: ${data.area} га
                `);
            }
            
            alert('Дані успішно оновлено!');
            closeModal();
            await loadAllParcelsToMap();
        } else {
            throw new Error('Дані не було оновлено');
        }
    } catch (error) {
        console.error('Детальна помилка оновлення:', error);
        alert(`Помилка оновлення: ${error.message}`);
    }
}

// Добавляем вспомогательную функцию для поиска слоя на карте
function findLayerByCadnum(cadnum) {
    let targetLayer = null;
    parcelsLayer.eachLayer(layer => {
        if (layer.feature.properties.cadnum === cadnum) {
            targetLayer = layer;
        }
    });
    return targetLayer;
}

// Додаємо функцію очищення пошуку
async function clearSearch() {
    document.getElementById('searchCadnum').value = ''; // Очищаємо поле пошуку
    await loadAllParcelsToMap(); // Завантажуємо всі ділянки
}

// Удаляем функцию toggleSearchButton и oninput из input

async function handleSearch() {
    const cadnum = document.getElementById('searchCadnum').value;
    const coatuuValue = document.getElementById('coatuuDropdown').value;
    const namecoatuuFilters = coatuuValue ? [coatuuValue] : [];
    await loadAllParcelsToMap(cadnum, namecoatuuFilters);
}

// Добавляем функцию выхода
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'index.html'; // Перенаправляем на главную после выхода
    } catch (error) {
        console.error('Помилка виходу:', error);
        alert(`Помилка виходу: ${error.message}`);
    }
}

// Добавляем проверку авторизации при загрузке страницы
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html'; // Если нет сессии, перенаправляем на страницу входа
        return;
    }

    // Показываем email пользователя
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement && session.user) {
        userEmailElement.textContent = session.user.email;
    }
}

// Обновляем инициализацию
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth(); // Сначала проверяем авторизацию
    initMap(); // Затем инициализируем карту
    loadAllParcelsToMap();
    // При изменении берём массив выбранных значень
    document.getElementById('coatuuDropdown').addEventListener('change', (event) => {
        const selectedValue = event.target.value;
        const filters = selectedValue ? [selectedValue] : [];
        loadAllParcelsToMap('', filters);
    });
});

async function insertTestData() {
    try {
        const { data, error } = await supabase
            .from('parcels')
            .insert([
                { 
                    created_at: new Date().toISOString(),
                    tracking_number: 'TN001',
                    status: 'pending',
                    sender: 'John Doe',
                    receiver: 'Jane Smith',
                    weight_kg: 1.5,
                    price: 100.50
                },
                { 
                    created_at: new Date().toISOString(),
                    tracking_number: 'TN002',
                    status: 'in_transit',
                    sender: 'Alice Brown',
                    receiver: 'Bob Wilson',
                    weight_kg: 2.3,
                    price: 150.75
                }
            ]);
            
        if (error) throw error;
        fetchData();
    } catch (error) {
        document.getElementById('data').innerHTML = `Помилка додавання: ${error.message}`;
        console.error('Повна помилка:', error);
    }
}

async function showTableStructure() {
    const dataContainer = document.getElementById('data');
    dataContainer.innerHTML = 'Виконується розширена діагностика...';
    
    try {
        // Проверка сессии
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Сесія:', session);

        // Пробуем прямой запрос с явным указанием схемы
        const { data, error, count } = await supabase
            .from('parcels')
            .select('*', {
                count: 'exact',
                head: false
            })
            .limit(5)
            .throwOnError();
            
        console.log('Прямий запит:', { data, error });
        
        // Проверяем RLS
        const { data: rlsData } = await supabase.rpc('get_raw_parcels');
        console.log('RLS дані:', rlsData);
        
        const diagnosticInfo = {
            auth_status: {
                has_session: !!session,
                session_error: sessionError?.message
            },
            query_result: {
                received_data: data,
                row_count: count,
                has_data: data && data.length > 0,
                first_row: data && data.length > 0 ? data[0] : null,
                error: error?.message
            },
            rls_check: {
                has_rls_data: !!rlsData,
                rls_count: rlsData?.length
            },
            connection_info: {
                url: SUPABASE_URL,
                auth_present: !!SUPABASE_ANON_KEY
            },
            timestamp: new Date().toISOString()
        };
        
        dataContainer.innerHTML = `<pre>Розширена діагностика:\n${JSON.stringify(diagnosticInfo, null, 2)}</pre>`;
        
    } catch (error) {
        console.error('Детальна помилка:', error);
        dataContainer.innerHTML = `<pre>Критична помилка:\n${JSON.stringify({
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            time: new Date().toISOString()
        }, null, 2)}</pre>`;
    }
}

async function populateCoatuuDropdown(data) {
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
    $('#coatuuDropdown').select2(); // Инициализируем Select2
}
