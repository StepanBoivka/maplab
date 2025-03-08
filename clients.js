// Инициализация Supabase 
let supabase;

// Переменная для хранения данных о клиентах
let clients = [];

// Добавляем переменную для хранения статусов
let availableStatuses = [];

// Инициализация страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Показываем индикатор загрузки
    document.querySelector('.loading-indicator').style.display = 'flex';
    
    try {
        // Проверяем что библиотека загружена
        if (!window.supabaseLoaded) {
            console.error('Библиотека Supabase не загружена. Проверьте подключение скрипта.');
            alert('Помилка ініціалізації: бібліотека Supabase не завантажена');
            return;
        }
        
        // Проверяем наличие функции initializeSupabase в глобальном контексте
        if (typeof initializeSupabase === 'function') {
            supabase = initializeSupabase();
            console.log('Supabase успешно инициализирован');
        } else {
            console.error('Функция initializeSupabase не найдена. Проверьте подключение config.js');
            alert('Помилка ініціалізації: функція initializeSupabase не знайдена');
            return;
        }
    } catch (err) {
        console.error('Ошибка при инициализации Supabase:', err);
        alert('Не вдалося підключитися до бази даних: ' + err.message);
        return;
    }

    // Проверяем авторизацию
    try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
            // Пользователь не авторизован - показываем сообщение и редиректим на главную
            document.getElementById('auth-message').style.display = 'block';
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }

        // Пользователь авторизован - показываем email
        document.getElementById('userEmail').textContent = data.user.email;
        
        // Отображаем основной контент
        document.getElementById('clients-content').style.display = 'block';
        
        // Загружаем только статусы при старте
        await loadStatuses();
        
        // Инициализируем обработчики событий
        initializeEventListeners();
        
        // Очищаем таблицу и показываем сообщение
        const tableBody = document.getElementById('clientsTableBody');
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Оберіть статус для завантаження даних</td></tr>';
        
    } catch (err) {
        console.error('Ошибка при инициализации:', err);
        alert('Помилка ініціалізації: ' + err.message);
    } finally {
        document.querySelector('.loading-indicator').style.display = 'none';
    }
});

// Функция инициализации всех обработчиков событий
function initializeEventListeners() {
    // Добавляем обработчик поиска если элемент существует
    const searchInput = document.getElementById('searchClient');
    if (searchInput) {
        searchInput.addEventListener('input', filterClients);
    }
    
    // Добавляем обработчик поиска по ЕДРПОУ
    const searchEdrpou = document.getElementById('searchEdrpou');
    if (searchEdrpou) {
        searchEdrpou.addEventListener('input', filterClients);
    }
    
    // Обработчик для кнопки сохранения
    const saveButton = document.getElementById('saveClientBtn');
    if (saveButton) {
        saveButton.addEventListener('click', handleSaveClient);
    }
    
    // Обработчик для модального окна - исправляем
    const clientModal = document.getElementById('clientModal');
    if (clientModal) {
        clientModal.addEventListener('show.bs.modal', function(event) {
            const button = event.relatedTarget;
            if (button && button.id === 'addClientBtn') {
                // Если это кнопка добавления нового клиента
                document.getElementById('clientModalLabel').textContent = 'Додати клієнта';
                // Очищаем форму напрямую через установку значений
                document.getElementById('clientId').value = '';
                document.getElementById('clientEdrpou').value = '';
                document.getElementById('clientName').value = '';
                document.getElementById('clientStatus').value = '';
                document.getElementById('clientKved').value = '';
                document.getElementById('clientPhone').value = '';
                document.getElementById('clientEmail').value = '';
                document.getElementById('clientAddress').value = '';
                document.getElementById('clientNote').value = '';
                document.getElementById('clientDetails').value = '';
                document.getElementById('clientRepPosition').value = '';
                document.getElementById('clientDirectorShort').value = '';
                document.getElementById('clientDirectorGenitive').value = '';
                
                // Активируем первую вкладку
                const firstTab = clientModal.querySelector('.nav-monday .nav-link');
                if (firstTab) {
                    const tab = new bootstrap.Tab(firstTab);
                    tab.show();
                }
            }
        });

        clientModal.addEventListener('shown.bs.modal', function () {
            document.getElementById('clientName').focus();
        });
    }
    
    // Обработчик для кнопки закрытия модального окна
    const closeButton = document.querySelector('.btn-close');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            const modalElement = document.getElementById('clientModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        });
    }

    // Добавляем обработчик изменения фильтра статуса
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', fetchClients);
    }

    // Добавляем обработчик для фильтра по областям
    const regionFilter = document.getElementById('regionFilter');
    if (regionFilter) {
        regionFilter.addEventListener('change', filterClients);
    }
}

// Функция для получения данных о клиентах с пагинацией
async function fetchClients() {
    document.querySelector('.loading-indicator').style.display = 'flex';
    
    try {
        const statusFilter = document.getElementById('statusFilter').value;
        console.log('Текущий фильтр статуса:', statusFilter);
        
        // Получаем общее количество записей
        let allData = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            console.log(`Загрузка страницы ${page + 1}, смещение: ${page * pageSize}`);
            
            const { data, error } = await supabase
                .rpc('filter_contractors_by_status', {
                    status_filter: statusFilter || null
                })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error('Ошибка запроса:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            allData = allData.concat(data);
            console.log(`Получено ${data.length} записей на странице ${page + 1}`);
            
            // Если получили меньше записей чем размер страницы, значит это последняя страница
            if (data.length < pageSize) {
                hasMore = false;
            }
            
            page++;
        }

        clients = allData;
        console.log(`Всего загружено ${clients.length} записей${statusFilter ? ` со статусом "${statusFilter}"` : ''}`);
        
        // После загрузки клиентов обновляем список областей
        const regions = getUniqueRegions(clients);
        const regionFilter = document.getElementById('regionFilter');
        if (regionFilter) {
            regionFilter.innerHTML = '<option value="">Всі області</option>' +
                regions.map(region => 
                    `<option value="${escapeHtml(region.toLowerCase())}">${escapeHtml(region)}</option>`
                ).join('');
        }

        renderClientsTable();
        
    } catch (err) {
        console.error('Ошибка получения данных:', err);
        alert('Помилка при завантаженні даних');
    } finally {
        document.querySelector('.loading-indicator').style.display = 'none';
    }
}

// Функция для отображения клиентов в таблице
function renderClientsTable() {
    const tableBody = document.getElementById('clientsTableBody');
    const statusIndicator = document.getElementById('currentStatus');
    tableBody.innerHTML = '';
    
    // Показываем текущий статус
    const currentStatus = document.getElementById('statusFilter').value;
    if (statusIndicator) {
        statusIndicator.textContent = currentStatus || 'Не вибрано';
    }

    if (!clients || clients.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="text-center">Немає доступних клієнтів</td>';
        tableBody.appendChild(row);
        return;
    }
    
    const sortedClients = [...clients].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const displayClients = sortedClients.slice(0, 100);
    
    displayClients.forEach(client => {
        // Проверяем КВЕД на сельхоз деятельность
        const isAgricultural = client.kved && client.kved.toLowerCase().includes('вирощування зернових');
        const agriculturalIcon = isAgricultural ? '<i class="fas fa-wheat-alt text-warning" title="Сільськогосподарське підприємство"></i>' : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(client.edrpou || '')}</td>
            <td>${escapeHtml(client.name || '')}</td>
            <td class="text-center">${agriculturalIcon}</td>
            <td>${client.phone ? `<a href="tel:${escapeHtml(client.phone)}">${escapeHtml(client.phone)}</a>` : ''}</td>
            <td>${client.email ? `<a href="mailto:${escapeHtml(client.email)}">${escapeHtml(client.email)}</a>` : ''}</td>
            <td>${escapeHtml(client.note || '')}</td>
            <td class="text-end">
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-info" onclick="viewClient(${client.id})" title="Переглянути">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary" onclick="editClient(${client.id})" title="Редагувати">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteClient(${client.id})" title="Видалити">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    const infoRow = document.createElement('tr');
    infoRow.innerHTML = `
        <td colspan="6" class="text-center text-muted">
            <small>Показано ${displayClients.length} із ${clients.length} записів</small>
        </td>
    `;
    tableBody.appendChild(infoRow);
}

// Обновляем функцию просмотра клиента
function viewClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const generalInfo = `
        <div class="tab-pane fade show active" id="general-info">
            <div class="client-details">
                <div class="detail-row">
                    <div class="detail-label">ЄДРПОУ</div>
                    <div class="detail-value">${escapeHtml(client.edrpou || '')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Назва</div>
                    <div class="detail-value">${escapeHtml(client.name || '')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Статус</div>
                    <div class="detail-value">${escapeHtml(client.status || '')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">КВЕД</div>
                    <div class="detail-value">${escapeHtml(client.kved || '')}</div>
                </div>
            </div>
        </div>`;
        
    const contacts = `
        <div class="tab-pane fade" id="contacts">
            <div class="client-details">
                <div class="detail-row">
                    <div class="detail-label">Телефон</div>
                    <div class="detail-value">${escapeHtml(client.phone || '')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${escapeHtml(client.email || '')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Адреса</div>
                    <div class="detail-value">${escapeHtml(client.address || '')}</div>
                </div>
            </div>
        </div>`;
        
    const additional = `
        <div class="tab-pane fade" id="additional">
            <div class="client-details">
                <div class="detail-row">
                    <div class="detail-label">Примітка</div>
                    <div class="detail-value">${escapeHtml(client.note || '')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Деталі</div>
                    <div class="detail-value">${escapeHtml(client.details || '')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Посада представника</div>
                    <div class="detail-value">${escapeHtml(client.representative_position || '')}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Директор</div>
                    <div class="detail-value">${escapeHtml(client.director_short_name || '')}</div>
                </div>
            </div>
        </div>`;

    const viewModal = document.getElementById('viewModal');
    const tabContent = viewModal.querySelector('.tab-content');
    tabContent.innerHTML = generalInfo + contacts + additional;
    
    // Сохраняем ID текущего клиента для кнопки редактирования
    window.currentClientId = client.id;
    
    const editButton = viewModal.querySelector('.btn-monday-primary');
    editButton.onclick = () => {
        // Сначала закрываем модальное окно просмотра
        const viewModalInstance = bootstrap.Modal.getInstance(viewModal);
        viewModalInstance.hide();
        
        // После закрытия открываем окно редактирования
        setTimeout(() => {
            editClient(clientId);
        }, 150);
    };
    
    new bootstrap.Modal(viewModal).show();
}

function closeViewModal() {
    const viewModal = document.getElementById('viewModal');
    const modal = bootstrap.Modal.getInstance(viewModal);
    if (modal) {
        modal.hide();
    }
}

// Делаем функцию глобальной
window.viewClient = viewClient;

// Обновляем функцию фильтрации клиентов
function filterClients(event) {
    const searchText = document.getElementById('searchClient').value.toLowerCase().trim();
    const searchEdrpou = document.getElementById('searchEdrpou').value.toLowerCase().trim();
    const selectedRegion = document.getElementById('regionFilter').value.toLowerCase().trim();
    
    // Если все поля поиска пустые, показываем первые 100 записей
    if (!searchText && !searchEdrpou && !selectedRegion) {
        renderClientsTable();
        return;
    }
    
    const filteredClients = clients.filter(client => {
        const matchName = client.name && client.name.toLowerCase().includes(searchText);
        const matchEdrpou = client.edrpou && client.edrpou.toLowerCase().includes(searchEdrpou);
        const clientRegion = extractRegion(client.address)?.toLowerCase();
        const matchRegion = !selectedRegion || (clientRegion && clientRegion === selectedRegion);
        
        // Если поле ЕДРПОУ заполнено, используем его как приоритетный фильтр
        if (searchEdrpou) {
            return matchEdrpou && matchRegion;
        }
        
        // Ищем только по имени и региону
        return matchName && matchRegion;
    });
    
    // Остальной код функции без изменений...
    const tableBody = document.getElementById('clientsTableBody');
    tableBody.innerHTML = '';
    
    if (filteredClients.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" class="text-center">Нічого не знайдено</td>';
        tableBody.appendChild(row);
        return;
    }
    
    // Показываем только первые 100 найденных записей
    const displayClients = filteredClients.slice(0, 100);
    displayClients.forEach(client => {
        const isAgricultural = client.kved && client.kved.toLowerCase().includes('вирощування зернових');
        const agriculturalIcon = isAgricultural ? '<i class="fas fa-wheat-alt text-warning" title="Сільськогосподарське підприємство"></i>' : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(client.edrpou || '')}</td>
            <td>${escapeHtml(client.name || '')}</td>
            <td class="text-center">${agriculturalIcon}</td>
            <td>${client.phone ? `<a href="tel:${escapeHtml(client.phone)}">${escapeHtml(client.phone)}</a>` : ''}</td>
            <td>${client.email ? `<a href="mailto:${escapeHtml(client.email)}">${escapeHtml(client.email)}</a>` : ''}</td>
            <td>${escapeHtml(client.note || '')}</td>
            <td class="text-end">
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-info" onclick="viewClient(${client.id})" title="Переглянути">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary" onclick="editClient(${client.id})" title="Редагувати">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteClient(${client.id})" title="Видалити">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
        
        // Делаем строку кликабельной
        row.addEventListener('click', function(e) {
            if (!e.target.closest('button')) {
                editClient(client.id);
                const modal = new bootstrap.Modal(document.getElementById('clientModal'));
                modal.show();
            }
        });
    });
    
    // Добавляем информацию о кількості знайдених записів
    const infoRow = document.createElement('tr');
    infoRow.innerHTML = `
        <td colspan="6" class="text-center text-muted">
            <small>Знайдено ${filteredClients.length} записів</small>
        </td>
    `;
    tableBody.appendChild(infoRow);
}

// Обновляем функцию редактирования клиента
function editClient(clientId) {
    console.log('Начало редактирования клиента:', clientId);
    
    // Находим клиента в массиве по ID
    const client = clients.find(c => c.id === clientId);
    if (!client) {
        console.error('Клієнт не знайдений:', clientId);
        return;
    }
    
    const modalElement = document.getElementById('clientModal');
    if (!modalElement) {
        console.error('Модальне вікно не знайдено');
        return;
    }
    
    // Заполняем форму данными клиента
    document.getElementById('clientModalLabel').textContent = 'Редагувати клієнта';
    document.getElementById('clientId').value = client.id;
    
    // Заполняем основную информацию
    document.getElementById('clientEdrpou').value = client.edrpou || '';
    document.getElementById('clientName').value = client.name || '';
    document.getElementById('clientStatus').value = client.status || '';
    document.getElementById('clientKved').value = client.kved || '';
    
    // Заполняем контактную информацию
    document.getElementById('clientPhone').value = client.phone || '';
    document.getElementById('clientEmail').value = client.email || '';
    document.getElementById('clientAddress').value = client.address || '';
    
    // Заполняем дополнительную информацию
    document.getElementById('clientNote').value = client.note || '';
    document.getElementById('clientDetails').value = client.details || '';
    document.getElementById('clientRepPosition').value = client.representative_position || '';
    document.getElementById('clientDirectorShort').value = client.director_short_name || '';
    document.getElementById('clientDirectorGenitive').value = client.director_genitive || '';
    
    // Активируем первую вкладку
    const firstTab = modalElement.querySelector('.nav-monday .nav-link');
    if (firstTab) {
        const tab = new bootstrap.Tab(firstTab);
        tab.show();
    }
    
    // Показываем модальное окно
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// Обработчик сохранения клиента
async function handleSaveClient() {
    const clientId = document.getElementById('clientId').value;
    const clientData = {
        edrpou: document.getElementById('clientEdrpou').value.trim(),
        name: document.getElementById('clientName').value.trim(),
        phone: document.getElementById('clientPhone').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        address: document.getElementById('clientAddress').value.trim(),
        kved: document.getElementById('clientKved').value.trim(),
        status: document.getElementById('clientStatus').value.trim(),
        note: document.getElementById('clientNote').value.trim(),
        details: document.getElementById('clientDetails').value.trim(),
        representative_position: document.getElementById('clientRepPosition').value.trim(),
        director_short_name: document.getElementById('clientDirectorShort').value.trim(),
        director_genitive: document.getElementById('clientDirectorGenitive').value.trim()
    };
    
    if (!clientData.name) {
        alert('ПІБ клієнта обов\'язковий');
        return;
    }
    
    document.querySelector('.loading-indicator').style.display = 'flex';
    
    try {
        let result;
        if (clientId) {
            // Обновление существующего клиента
            result = await supabase
                .from('contractors')
                .update(clientData)
                .eq('id', clientId);
        } else {
            // Создание нового клиента
            result = await supabase
                .from('contractors')
                .insert([clientData]);
        }
        
        if (result.error) {
            console.error('Помилка при збереженні клієнта:', result.error);
            alert('Не вдалося зберегти дані клієнта');
            return;
        }
        
        // Закрываем модальное окно
        const modalElement = document.getElementById('clientModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        } else {
            // Если getInstance не сработал, создаем новый экземпляр
            const modal = new bootstrap.Modal(modalElement);
            modal.hide();
        }
        
        // Обновляем список клиентов
        await fetchClients();
        
    } catch (err) {
        console.error('Помилка при виконанні запиту:', err);
        alert('Сталася помилка при збереженні даних');
    } finally {
        document.querySelector('.loading-indicator').style.display = 'none';
    }
}

// Функция для удаления клиента
async function deleteClient(id) {
    if (!confirm('Ви впевнені, що хочете видалити цього клієнта?')) {
        return;
    }
    
    document.querySelector('.loading-indicator').style.display = 'flex';
    
    try {
        const { error } = await supabase
            .from('contractors')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Помилка при видаленні клієнта:', error);
            alert('Не вдалося видалити клієнта');
            return;
        }
        
        await fetchClients();
    } catch (err) {
        console.error('Помилка при виконанні запиту:', err);
        alert('Сталася помилка при видаленні клієнта');
    } finally {
        document.querySelector('.loading-indicator').style.display = 'none';
    }
}

// Функция для выхода из системы
function signOut() {
    supabase.auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}

// Вспомогательная функция для безопасного отображения HTML
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Функция для загрузки статусов
async function loadStatuses() {
    try {
        console.log('Загрузка статусов из базы...');
        const { data, error } = await supabase
            .from('statuses')
            .select('id, name')  // Используем id и name из таблицы statuses
            .order('name');
            
        if (error) throw error;
        
        console.log('Полученные статусы:', data);
        availableStatuses = data;
        
        // Заполняем селект в фильтре только статусами (без опции "Всі")
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.innerHTML = availableStatuses.map(status => 
                `<option value="${escapeHtml(status.name)}">${escapeHtml(status.name)}</option>`
            ).join('');
            // Добавляем placeholder
            statusFilter.insertAdjacentHTML('afterbegin', '<option value="" disabled selected>Оберіть статус</option>');
        }
        
        // Заполняем селект в модальном окне
        const statusSelect = document.getElementById('clientStatus');
        if (statusSelect) {
            statusSelect.innerHTML = '<option value="" disabled selected>Оберіть статус</option>' +
                availableStatuses.map(status => 
                    `<option value="${escapeHtml(status.name)}">${escapeHtml(status.name)}</option>`
                ).join('');
        }

        console.log('Селекты статусов обновлены');
    } catch (err) {
        console.error('Помилка при завантаженні статусів:', err);
        console.error('Детали ошибки:', {
            message: err.message,
            details: err.details,
            hint: err.hint,
            code: err.code
        });
        alert('Не вдалося завантажити список статусів');
    }
}

// Добавляем функцию извлечения области из адреса
function extractRegion(address) {
    if (!address) return null;
    
    // Ищем "обл." в адресе
    const match = address.match(/,\s*([^,]+)\s*обл\./i);
    if (match && match[1]) {
        return match[1].trim();
    }
    return null;
}

// Функция получения уникальных областей из данных
function getUniqueRegions(clients) {
    const regions = new Set();
    clients.forEach(client => {
        const region = extractRegion(client.address);
        if (region) {
            regions.add(region);
        }
    });
    return Array.from(regions).sort();
}

// Делаем функции глобальными для возможности вызова из HTML
window.editClient = editClient;
window.deleteClient = deleteClient;
window.signOut = signOut;
window.viewClient = viewClient;
