let client = new AgroDBClient();
let fileData = null;
let mappingModal = null;
let loadTablesBtn = null;
let importButton = null;

document.addEventListener('DOMContentLoaded', () => {
    const connectionBtn = document.getElementById('checkConnection');
    const statusEl = document.getElementById('connection-status');
    const tablesList = document.getElementById('tablesList');
    
    // Инициализируем кнопки
    loadTablesBtn = document.getElementById('loadTables');
    importButton = document.getElementById('importButton');
    
    // Изначально кнопки отключены
    loadTablesBtn.disabled = true;
    importButton.disabled = true;

    connectionBtn.addEventListener('click', async () => {
        statusEl.querySelector('.status-text').textContent = 'Статус: перевірка з\'єднання...';
        try {
            const isConnected = await client.checkConnection();
            statusEl.querySelector('.status-text').textContent = `Статус: ${isConnected ? 'підключено' : 'відключено'}`;
            statusEl.querySelector('.status-dot').classList.toggle('connected', isConnected);
            
            if (isConnected) {
                loadTablesBtn.disabled = false;
                importButton.disabled = false;
                await loadDatabaseStats();
            } else {
                loadTablesBtn.disabled = true;
                importButton.disabled = true;
            }
        } catch (error) {
            console.error('Помилка перевірки з\'єднання:', error);
            statusEl.querySelector('.status-text').textContent = 'Статус: помилка з\'єднання';
            statusEl.querySelector('.status-dot').classList.remove('connected');
            loadTablesBtn.disabled = true;
            importButton.disabled = true;
        }
    });

    loadTablesBtn.addEventListener('click', async () => {
        const tableDiv = document.getElementById('tableData');
        const dataLoadedBadge = document.querySelector('.data-loaded-badge');
        
        try {
            tableDiv.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
            loadTablesBtn.disabled = true;
            
            // Изменяем SQL запрос для группировки по радам
            const query = `
                WITH rada_mapping AS (
                    SELECT 
                        SUBSTR(k1.koatuu, 1, 8) || '00' as rada_koatuu,
                        k2.nameobl,
                        k2.namerayon,
                        k2.namesr
                    FROM koatuu k1
                    JOIN koatuu k2 ON k2.koatuu = SUBSTR(k1.koatuu, 1, 8) || '00'
                    WHERE LENGTH(k1.koatuu) = 10
                )
                SELECT 
                    r.nameobl as Область,
                    r.namerayon as Район,
                    r.namesr as Рада,
                    COUNT(*) as Кількість,
                    SUM(CAST(SUBSTR(CAST(d.area AS TEXT), 1, CASE 
                        WHEN INSTR(d.area, ' га') > 0 
                        THEN INSTR(d.area, ' га') - 1 
                        ELSE LENGTH(d.area) 
                    END) AS FLOAT)) as Площа
                FROM dzk_get d
                JOIN rada_mapping r ON r.rada_koatuu = SUBSTR(d.coatuu, 1, 8) || '00'
                GROUP BY r.nameobl, r.namerayon, r.namesr
                ORDER BY r.nameobl, r.namerayon, r.namesr
            `;
            
            const data = await client.executeQuery(query);
            console.log('Received data:', data);
            
            if (data && data.data && data.data.length > 0) {
                // Отображение сгруппированных данных
                const tableData = data.data;
                const table = `
                    <table class="table table-striped table-sm">
                        <thead>
                            <tr>
                                <th>Область</th>
                                <th>Район</th>
                                <th>Рада</th>
                                <th class="text-end">Кількість</th>
                                <th class="text-end">Площа, га</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableData.map(row => `
                                <tr>
                                    <td>${row.Область || '-'}</td>
                                    <td>${row.Район || '-'}</td>
                                    <td>${row.Рада || '-'}</td>
                                    <td class="text-end">${formatNumber(row.Кількість)}</td>
                                    <td class="text-end">${formatArea(row.Площа)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="table-info">
                                <td colspan="3"><strong>Всього:</strong></td>
                                <td class="text-end"><strong>${formatNumber(tableData.reduce((sum, row) => sum + row.Кількість, 0))}</strong></td>
                                <td class="text-end"><strong>${formatArea(tableData.reduce((sum, row) => sum + row.Площа, 0))}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                `;
                tableDiv.innerHTML = table;
                dataLoadedBadge.style.display = 'inline-block';
                loadTablesBtn.classList.remove('btn-outline-light');
                loadTablesBtn.classList.add('btn-light');
            } else {
                tableDiv.innerHTML = '<div class="alert alert-info">Немає даних</div>';
            }
        } catch (error) {
            console.error('Помилка завантаження даних:', error);
            tableDiv.innerHTML = `
                <div class="alert alert-danger">
                    Помилка завантаження даних: ${error.message}
                </div>
            `;
            dataLoadedBadge.style.display = 'none';
            loadTablesBtn.classList.remove('btn-light');
            loadTablesBtn.classList.add('btn-outline-light');
        } finally {
            loadTablesBtn.disabled = false;
        }
    });

    // Обработчик для кнопки импорта
    importButton.addEventListener('click', () => {
        const importModal = new bootstrap.Modal(document.getElementById('importModal'));
        importModal.show();
    });

    // Обработчик изменения файла
    const importFile = document.getElementById('importFile');
    importFile.addEventListener('change', async () => {
        const file = importFile.files[0];
        if (!file) return;

        try {
            const importModal = bootstrap.Modal.getInstance(document.getElementById('importModal'));
            if (importModal) importModal.hide();

            fileData = await readFileData(file);
            const schema = await client.getTableSchema('dzk_get');
            showMappingDialog(fileData[0], schema);
            mappingModal = new bootstrap.Modal(document.getElementById('mappingModal'));
            mappingModal.show();
        } catch (error) {
            console.error('Помилка читання файлу:', error);
            alert('Помилка читання файлу: ' + error.message);
        }
    });

    // Обработчик для кнопки импорта в модальном окне
    document.getElementById('startImport').addEventListener('click', async () => {
        const mappings = collectMappings();
        await importWithProgress(fileData, mappings);
    });

    // Добавляем обработчик для кнопки статистики
    const toggleStatsBtn = document.getElementById('toggleStats');
    const datesStats = document.getElementById('datesStats');
    
    toggleStatsBtn.addEventListener('click', function() {
        const isHidden = datesStats.style.display === 'none';
        datesStats.style.display = isHidden ? 'block' : 'none';
        this.querySelector('.toggle-text').textContent = 
            isHidden ? 'Приховати статистику оновлень' : 'Показати статистику оновлень';
    });

    // Добавляем обработчики фильтров
    let filters = {
        oblast: '',
        rayon: '',
        rada: '',
        radaSearch: ''
    };

    const oblastFilter = document.getElementById('oblastFilter');
    const rayonFilter = document.getElementById('rayonFilter');
    const radaFilter = document.getElementById('radaFilter');
    const radaSearch = document.getElementById('radaSearch');
    const resetFilters = document.getElementById('resetFilters');

    // Загружаем списки для фильтров
    async function loadFilters() {
        try {
            // Сначала загружаем только области
            const oblastQuery = `
                SELECT DISTINCT nameobl 
                FROM koatuu 
                WHERE nameobl IS NOT NULL 
                ORDER BY nameobl`;
            
            const result = await client.executeQuery(oblastQuery);
            
            if (result && result.data) {
                // Заполняем список областей
                oblastFilter.innerHTML = '<option value="">Виберіть область</option>' + 
                    result.data.map(row => `<option value="${row.nameobl}">${row.nameobl}</option>`).join('');
                
                // Сбрасываем остальные фильтры
                rayonFilter.innerHTML = '<option value="">Спочатку виберіть область</option>';
                rayonFilter.disabled = true;
                
                radaFilter.innerHTML = '<option value="">Спочатку виберіть район</option>';
                radaFilter.disabled = true;
                
                // Очищаем таблицу
                document.getElementById('tableData').innerHTML = '<div class="alert alert-info">Виберіть область для завантаження даних</div>';
            }

            // Обработчики изменения фильтров
            oblastFilter.addEventListener('change', async () => {
                filters.oblast = oblastFilter.value;
                if (filters.oblast) {
                    await updateRayonFilter();
                } else {
                    rayonFilter.innerHTML = '<option value="">Спочатку виберіть область</option>';
                    rayonFilter.disabled = true;
                    radaFilter.innerHTML = '<option value="">Спочатку виберіть район</option>';
                    radaFilter.disabled = true;
                }
                document.getElementById('tableData').innerHTML = '<div class="alert alert-info">Виберіть район для завантаження даних</div>';
            });

            rayonFilter.addEventListener('change', async () => {
                filters.rayon = rayonFilter.value;
                if (filters.rayon) {
                    await updateRadaFilter();
                } else {
                    radaFilter.innerHTML = '<option value="">Спочатку виберіть район</option>';
                    radaFilter.disabled = true;
                }
                if (filters.rayon) {
                    await loadTableData();
                } else {
                    document.getElementById('tableData').innerHTML = '<div class="alert alert-info">Виберіть район для завантаження даних</div>';
                }
            });

            radaFilter.addEventListener('change', async () => {
                filters.rada = radaFilter.value;
                if (filters.rayon) { // Загружаем данные если выбран район
                    await loadTableData();
                }
            });

            // Обновляем функции обновления фильтров
            async function updateRayonFilter() {
                const rayonQuery = `
                    SELECT DISTINCT namerayon 
                    FROM koatuu 
                    WHERE nameobl = '${filters.oblast.replace(/'/g, "''")}' 
                    AND namerayon IS NOT NULL 
                    ORDER BY namerayon`;
                
                const result = await client.executeQuery(rayonQuery);
                
                rayonFilter.innerHTML = '<option value="">Виберіть район</option>' +
                    result.data.map(row => `<option value="${row.namerayon}">${row.namerayon}</option>`).join('');
                rayonFilter.disabled = false;
            }

            async function updateRadaFilter() {
                const radaQuery = `
                    SELECT DISTINCT namesr 
                    FROM koatuu 
                    WHERE nameobl = '${filters.oblast.replace(/'/g, "''")}' 
                    AND namerayon = '${filters.rayon.replace(/'/g, "''")}' 
                    AND namesr IS NOT NULL 
                    ORDER BY namesr`;
                
                const result = await client.executeQuery(radaQuery);
                
                radaFilter.innerHTML = '<option value="">Всі ради</option>' +
                    result.data.map(row => `<option value="${row.namesr}">${row.namesr}</option>`).join('');
                radaFilter.disabled = false;
            }

            resetFilters.addEventListener('click', () => {
                filters = {
                    oblast: '',
                    rayon: '',
                    rada: '',
                    radaSearch: ''
                };
                oblastFilter.value = '';
                rayonFilter.innerHTML = '<option value="">Спочатку виберіть область</option>';
                rayonFilter.disabled = true;
                radaFilter.innerHTML = '<option value="">Спочатку виберіть район</option>';
                radaFilter.disabled = true;
                radaSearch.value = '';
                document.getElementById('tableData').innerHTML = '<div class="alert alert-info">Виберіть область для завантаження даних</div>';
            });
        } catch (error) {
            console.error('Помилка завантаження фільтрів:', error);
        }
    }

    // Модифицируем загрузку данных с учетом фильтров
    async function loadTableData() {
        const tableDiv = document.getElementById('tableData');
        try {
            tableDiv.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
            
            // Исправленный SQL запрос для корректного группирования по радам
            const queryStr = `
                WITH RECURSIVE 
                rada_codes AS (
                    -- Получаем коды рад
                    SELECT DISTINCT
                        k.koatuu as rada_koatuu,
                        k.nameobl,
                        k.namerayon,
                        k.namesr
                    FROM koatuu k
                    WHERE k.koatuu LIKE '%00'
                        ${filters.oblast ? `AND k.nameobl = '${filters.oblast.replace(/'/g, "''")}'` : ''}
                        ${filters.rayon ? `AND k.namerayon = '${filters.rayon.replace(/'/g, "''")}'` : ''}
                        ${filters.rada ? `AND k.namesr = '${filters.rada.replace(/'/g, "''")}'` : ''}
                ),
                filtered_data AS (
                    -- Связываем данные DZK с радами
                    SELECT 
                        d.*,
                        r.rada_koatuu,
                        r.nameobl,
                        r.namerayon,
                        r.namesr
                    FROM dzk_get d
                    JOIN rada_codes r ON SUBSTR(d.coatuu, 1, 8) || '00' = r.rada_koatuu
                ),
                summary AS (
                    -- Финальная агрегация по радам
                    SELECT 
                        nameobl as Область,
                        namerayon as Район,
                        namesr as Рада,
                        COUNT(*) as Кількість,
                        SUM(CAST(SUBSTR(CAST(area AS TEXT), 1, CASE 
                            WHEN INSTR(area, ' га') > 0 
                            THEN INSTR(area, ' га') - 1 
                            ELSE LENGTH(area) 
                        END) AS FLOAT)) as Площа,
                        MAX(date_update) as Оновлено,
                        GROUP_CONCAT(
                            cadnum || '|' || 
                            COALESCE(area, '') || '|' || 
                            COALESCE(edrpou, '') || '|' || 
                            COALESCE(namecompany, '') || '|' ||
                            COALESCE(date_update, '') || '|' ||
                            COALESCE(date_pravo, '') || '|' ||
                            COALESCE(date_ocinka, '') || '|' ||
                            COALESCE(ocinka, '') || '|' ||
                            COALESCE(neme, '')
                        ) as details
                    FROM filtered_data
                    GROUP BY nameobl, namerayon, namesr
                )
                SELECT * FROM summary
                ORDER BY Область, Район, Рада
                LIMIT 1000
            `;

            // Добавляем индикатор загрузки с процентами
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'text-center';
            loadingDiv.innerHTML = `
                <div class="spinner-border mb-2" role="status"></div>
                <div class="small text-muted">Завантаження даних...</div>
                <div class="progress mt-2" style="height: 5px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
                </div>
            `;
            tableDiv.innerHTML = '';
            tableDiv.appendChild(loadingDiv);

            console.log('Executing optimized query...');
            const data = await client.executeQuery(queryStr);
            console.log('Query completed');

            if (data && data.data && data.data.length > 0) {
                // Отображение сгруппированных данных
                const tableData = data.data;
                const table = `
                    <table class="table table-hover table-sm">
                        <thead>
                            <tr>
                                <th style="width: 30px"></th>
                                <th>Область</th>
                                <th>Район</th>
                                <th>Рада</th>
                                <th class="text-end">Кількість</th>
                                <th class="text-end">Площа, га</th>
                                <th class="text-center">Актуальність</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableData.map((row, index) => {
                                const status = getUpdateStatus(row.Оновлено);
                                return `
                                    <tr class="parent-row" data-index="${index}">
                                        <td>
                                            <button class="btn btn-sm btn-link expand-btn">
                                                <i class="bi bi-chevron-right"></i>
                                            </button>
                                        </td>
                                        <td>${row.Область || '-'}</td>
                                        <td>${row.Район || '-'}</td>
                                        <td>${row.Рада || '-'}</td>
                                        <td class="text-end">${formatNumber(row.Кількість)}</td>
                                        <td class="text-end">${formatArea(row.Площа)}</td>
                                        <td class="text-center">
                                            <span class="${status.class}" 
                                                  title="${row.Оновлено ? formatDate(row.Оновлено) : 'Дата оновлення відсутня'}">
                                                ${status.text}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr class="details-row" style="display: none;">
                                        <td colspan="7" class="details-content p-0">
                                            ${formatDetails(row.details)}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="table-info">
                                <td></td>
                                <td colspan="3"><strong>Всього:</strong></td>
                                <td class="text-end">
                                    <strong>${formatNumber(tableData.reduce((sum, row) => sum + row.Кількість, 0))}</strong>
                                </td>
                                <td class="text-end">
                                    <strong>${formatArea(tableData.reduce((sum, row) => sum + row.Площа, 0))}</strong>
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                `;
                tableDiv.innerHTML = table;

                // Добавляем обработчики для разворачивания строк
                document.querySelectorAll('.expand-btn').forEach(btn => {
                    btn.addEventListener('click', function(e) {
                        const parentRow = this.closest('tr');
                        const detailsRow = parentRow.nextElementSibling;
                        const icon = this.querySelector('i');
                        
                        if (detailsRow.style.display === 'none') {
                            detailsRow.style.display = 'table-row';
                            icon.classList.remove('bi-chevron-right');
                            icon.classList.add('bi-chevron-down');
                            parentRow.classList.add('expanded');
                        } else {
                            detailsRow.style.display = 'none';
                            icon.classList.remove('bi-chevron-down');
                            icon.classList.add('bi-chevron-right');
                            parentRow.classList.remove('expanded');
                        }
                    });
                });
            } else {
                tableDiv.innerHTML = '<div class="alert alert-info">Немає даних</div>';
            }
        } catch (error) {
            console.error('Помилка завантаження даних:', error);
            tableDiv.innerHTML = `<div class="alert alert-danger">Помилка завантаження даних: ${error.message}</div>`;
        }
    }

    function formatDetails(detailsStr) {
        if (!detailsStr) return '<div class="alert alert-info m-2">Немає детальних даних</div>';
        
        const details = detailsStr.split(',').map(detail => {
            const [cadnum, area, edrpou, namecompany, date_update, date_pravo, date_ocinka, ocinka, neme] = detail.split('|');
            return {
                cadnum, area, edrpou, namecompany, date_update, date_pravo, date_ocinka, ocinka, neme
            };
        });

        return `
            <div class="table-responsive">
                <table class="table table-sm table-bordered m-0">
                    <thead class="table-light">
                        <tr>
                            <th>Кадастровий номер</th>
                            <th>Площа</th>
                            <th>ЄДРПОУ</th>
                            <th>Назва компанії</th>
                            <th>Дата оновлення</th>
                            <th>Дата права</th>
                            <th>Дата оцінки</th>
                            <th>Оцінка</th>
                            <th>Власник</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${details.map(d => `
                            <tr>
                                <td>${d.cadnum || '-'}</td>
                                <td>${d.area ? formatArea(d.area) : '-'}</td>
                                <td>${d.edrpou || '-'}</td>
                                <td>${d.namecompany || '-'}</td>
                                <td>${formatDate(d.date_update)}</td>
                                <td>${formatDate(d.date_pravo)}</td>
                                <td>${formatDate(d.date_ocinka)}</td>
                                <td>${d.ocinka || '-'}</td>
                                <td>${d.neme || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Загружаем фильтры при инициализации
    loadFilters();
});

async function readFileData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = event => {
            try {
                if (file.name.endsWith('.json')) {
                    resolve(JSON.parse(event.target.result));
                } else if (file.name.endsWith('.csv')) {
                    // Простая обработка CSV
                    const csv = event.target.result;
                    const lines = csv.split('\n');
                    const headers = lines[0].split(',').map(h => h.trim());
                    
                    const data = lines.slice(1).map(line => {
                        const values = line.split(',');
                        return headers.reduce((obj, header, index) => {
                            obj[header] = values[index]?.trim() || '';
                            return obj;
                        }, {});
                    });
                    
                    resolve(data);
                } else {
                    reject(new Error('Непідтримуваний формат файлу'));
                }
            } catch (e) {
                reject(new Error('Помилка обробки файлу: ' + e.message));
            }
        };
        
        reader.onerror = () => reject(new Error('Помилка читання файлу'));
        
        if (file.name.endsWith('.json')) {
            reader.readAsText(file);
        } else if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reject(new Error('Непідтримуваний формат файлу'));
        }
    });
}

function showMappingDialog(sampleData, schema) {
    const container = document.querySelector('.mapping-container');
    const sourceFields = Object.keys(sampleData);
    const targetFields = schema.map(field => field.name);

    // Добавляем описания полей
    const fieldDescriptions = {
        cadnum: 'Кадастровий номер',
        area: 'Площа',
        date_ocinka: 'Дата оцінки',
        date_pravo: 'Дата права',
        edrpou: 'ЄДРПОУ',
        namecompany: 'Назва компанії',
        neme: 'Власник',
        ocinka: 'Оцінка'
    };

    const html = `
        <div class="mb-3">
            <button class="btn btn-sm btn-outline-primary" onclick="autoMapFields()">Автоматичне співставлення</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="resetMapping()">Скинути</button>
        </div>
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Поле у файлі</th>
                    <th style="width: 100px;">Імпортувати</th>
                    <th>Поле в базі</th>
                    <th>Опис</th>
                </tr>
            </thead>
            <tbody>
                ${sourceFields.map(field => `
                    <tr>
                        <td>
                            <code>${field}</code>
                            <br>
                            <small class="text-muted">Приклад: ${truncateValue(sampleData[field])}</small>
                        </td>
                        <td class="text-center">
                            <input type="checkbox" class="form-check-input mapping-enabled" 
                                   data-source="${field}" checked>
                        </td>
                        <td>
                            <select class="form-select form-select-sm mapping-target" data-source="${field}">
                                <option value="">Не імпортувати</option>
                                ${targetFields.map(target => `
                                    <option value="${target}" 
                                        ${target.toLowerCase() === field.toLowerCase() ? 'selected' : ''}>
                                        ${target}
                                    </option>
                                `).join('')}
                            </select>
                        </td>
                        <td><small>${fieldDescriptions[field] || ''}</small></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

function truncateValue(value, maxLength = 30) {
    if (!value) return '';
    const strValue = String(value);
    return strValue.length > maxLength ? strValue.substring(0, maxLength) + '...' : strValue;
}

function autoMapFields() {
    const selects = document.querySelectorAll('.mapping-target');
    selects.forEach(select => {
        const sourceField = select.dataset.source.toLowerCase();
        const options = Array.from(select.options);
        const bestMatch = options.find(option => 
            option.value.toLowerCase() === sourceField ||
            option.value.toLowerCase().includes(sourceField) ||
            sourceField.includes(option.value.toLowerCase())
        );
        if (bestMatch) {
            select.value = bestMatch.value;
        }
    });
}

function resetMapping() {
    const selects = document.querySelectorAll('.mapping-target');
    selects.forEach(select => select.value = '');
}

function collectMappings() {
    const mappings = {};
    const rows = document.querySelectorAll('.mapping-container tr');
    
    rows.forEach(row => {
        const checkbox = row.querySelector('.mapping-enabled');
        const select = row.querySelector('.mapping-target');
        if (checkbox && select && checkbox.checked && select.value) {
            mappings[checkbox.dataset.source] = select.value;
        }
    });
    
    return mappings;
}

// Обновляем функцию для логирования
function saveLog(message, type = 'info', details = null) {
    const timestamp = new Date().toISOString();
    let logMessage = message;
    let logDetails = details;

    // Преобразуем объекты в строки
    if (typeof message === 'object') {
        logMessage = JSON.stringify(message, null, 2);
    }

    if (typeof details === 'object') {
        logDetails = JSON.stringify(details, null, 2);
    }

    const logEntry = {
        timestamp,
        type,
        message: logMessage,
        details: logDetails
    };

    const logs = JSON.parse(sessionStorage.getItem('importLogs') || '[]');
    logs.push(logEntry);
    
    // Ограничиваем количество сохраненных логов
    if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
    }
    
    sessionStorage.setItem('importLogs', JSON.stringify(logs));
}

// Обновляем функцию showLogsInModal
function showLogsInModal() {
    let logsModal = document.getElementById('logsViewModal');
    
    // Если модального окна еще нет - создаем его
    if (!logsModal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal fade" id="logsViewModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Журнал імпорту</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Здесь будут логи -->
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="clearLogs()">Очистити журнал</button>
                            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Закрити</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        logsModal = document.getElementById('logsViewModal');
    }

    // Обновляем содержимое логов
    const logs = JSON.parse(sessionStorage.getItem('importLogs') || '[]');
    const logsHtml = `
        <div class="table-responsive">
            <table class="table table-sm table-striped">
                <thead>
                    <tr>
                        <th>Час</th>
                        <th>Тип</th>
                        <th>Повідомлення</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                        <tr class="${log.type === 'error' ? 'table-danger' : ''}">
                            <td><small>${new Date(log.timestamp).toLocaleTimeString()}</small></td>
                            <td>
                                <span class="badge bg-${log.type === 'error' ? 'danger' : 'info'}">
                                    ${log.type}
                                </span>
                            </td>
                            <td>
                                ${log.message}
                                ${log.details ? `<pre class="mt-2 text-muted small">${log.details}</pre>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    logsModal.querySelector('.modal-body').innerHTML = logsHtml;
    
    // Показываем модальное окно
    const modal = new bootstrap.Modal(logsModal);
    modal.show();
}

// Добавляем функцию очистки логов
function clearLogs() {
    sessionStorage.removeItem('importLogs');
    document.querySelector('#logsViewModal .modal-body').innerHTML = 
        '<div class="alert alert-info">Журнал очищено</div>';
}

// Заменяем функцию openLogsWindow на showLogsInModal
function showLogsInModal() {
    const logs = JSON.parse(sessionStorage.getItem('importLogs') || '[]');
    const modalHtml = `
        <div class="modal fade" id="logsViewModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Журнал імпорту</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="table-responsive">
                            <table class="table table-sm table-striped">
                                <thead>
                                    <tr>
                                        <th>Час</th>
                                        <th>Тип</th>
                                        <th>Повідомлення</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${logs.map(log => `
                                        <tr class="${log.type === 'error' ? 'table-danger' : ''}">
                                            <td><small>${new Date(log.timestamp).toLocaleTimeString()}</small></td>
                                            <td><span class="badge bg-${log.type === 'error' ? 'danger' : 'info'}">${log.type}</span></td>
                                            <td>
                                                ${log.message}
                                                ${log.details ? `<pre class="mt-2 text-muted small">${log.details}</pre>` : ''}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="sessionStorage.removeItem('importLogs'); document.querySelector('#logsViewModal .modal-body').innerHTML = '';">
                            Очистити логи
                        </button>
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Закрити</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Удаляем старое модальное окно если оно существует
    const oldModal = document.getElementById('logsViewModal');
    if (oldModal) {
        oldModal.remove();
    }

    // Добавляем новое модальное окно
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Показываем модальное окно
    const modal = new bootstrap.Modal(document.getElementById('logsViewModal'));
    modal.show();
}

// Модифицируем функцию importWithProgress
async function importWithProgress(data, mappings) {
    const progressBar = document.querySelector('.progress');
    const progressBarInner = progressBar.querySelector('.progress-bar');
    const modalDialog = document.querySelector('#mappingModal');
    const updateInterval = 1000; // Обновляем UI каждую секунду
    let lastUIUpdate = Date.now();
    const importCountBadge = document.querySelector('.import-count-badge');

    // Показываем прогресс-бар
    progressBar.style.display = 'block';
    progressBarInner.style.width = '0%';
    progressBarInner.classList.remove('bg-success', 'bg-danger');

    const importStats = {
        total: data.length,
        imported: 0,
        failed: 0,
        errors: [],
        skippedRecords: [],
        startTime: new Date(),
        endTime: null
    };

    try {
        // Подготовка данных
        const mappedData = data.map(item => {
            const mapped = {};
            for (const [source, target] of Object.entries(mappings)) {
                mapped[target] = item[source] || '';
            }
            return mapped;
        });

        // Отправляем все данные одним запросом
        console.log('Starting import of', mappedData.length, 'records');
        const result = await client.importDzkData(mappedData);

        if (result) {
            importStats.imported = result.inserted || 0;
            importStats.failed = (data.length - result.inserted);
            
            if (result.skipped) {
                importStats.skippedRecords = result.skipped;
                result.skipped.forEach(skip => {
                    saveLog(`Пропущено: ${skip.cadnum} - ${skip.reason}`, 'warning');
                });
            }
        }

        importStats.endTime = new Date();
        
        // Показываем результат
        progressBarInner.style.width = '100%';
        progressBarInner.textContent = '100%';
        progressBarInner.classList.add('bg-success');
        importCountBadge.style.display = 'inline-block';
        importCountBadge.textContent = result.inserted;
        importButton.classList.remove('btn-outline-success');
        importButton.classList.add('btn-success');
        
        // Показываем статистику
        const statsModal = await showImportSummary(importStats);
        statsModal._element.addEventListener('hidden.bs.modal', () => {
            // Только после закрытия статистики закрываем окно импорта
            const importModal = bootstrap.Modal.getInstance(modalDialog);
            if (importModal) {
                importModal.hide();
            }
        });

    } catch (error) {
        saveLog(error, 'error');
        progressBarInner.classList.add('bg-danger');
        progressBarInner.textContent = 'Помилка імпорту';
        importCountBadge.style.display = 'none';
        importButton.classList.remove('btn-success');
        importButton.classList.add('btn-outline-success');
        throw error;
    } finally {
        // Обновляем статистику
        try {
            await loadDatabaseStats();
            if (loadTablesBtn) {
                await new Promise(resolve => setTimeout(resolve, 500));
                loadTablesBtn.click();
            }
        } catch (error) {
            saveLog('Помилка оновлення статистики', 'error');
        }
    }
}

// Добавляем вспомогательную функцию форматирования времени
function formatTime(seconds) {
    if (seconds < 60) return `${seconds} сек`;
    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes} хв ${secs} сек`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} год ${minutes} хв`;
}

async function loadDatabaseStats() {
    try {
        // Изменяем запрос для базовой статистики
        const basicQuery = `
            SELECT 
                COUNT(*) total_records,
                COUNT(DISTINCT edrpou) unique_edrpou,
                SUM(CAST(total_area AS FLOAT)) total_area,
                MAX(date_update) last_update,
                SUM(CASE WHEN date_update IS NULL OR date_update = '' THEN 1 ELSE 0 END) no_update_date
            FROM (
                SELECT 
                    edrpou, 
                    date_update,
                    CAST(SUBSTR(CAST(area AS TEXT), 1, CASE WHEN INSTR(area, ' га') > 0 THEN INSTR(area, ' га') - 1 ELSE LENGTH(area) END) AS FLOAT) total_area
                FROM dzk_get
            )`;

        const result = await client.executeQuery(basicQuery);

        if (result && result.data && result.data.length > 0) {
            const stats = result.data[0];
            
            // Обновляем статистику на странице
            document.getElementById('totalRecords').textContent = formatNumber(stats.total_records);
            document.getElementById('uniqueEdrpou').textContent = formatNumber(stats.unique_edrpou);
            document.getElementById('totalArea').textContent = formatArea(stats.total_area);
            document.getElementById('lastUpdate').textContent = formatDate(stats.last_update);
            document.getElementById('noUpdateDate').textContent = formatNumber(stats.no_update_date);

            // Запрос статистики по месяцам
            const monthlyQuery = `
                SELECT 
                    SUBSTR(date_update, 1, 4) year,
                    SUBSTR(date_update, 6, 2) month,
                    COUNT(*) count
                FROM dzk_get 
                WHERE date_update IS NOT NULL
                GROUP BY year, month 
                ORDER BY year DESC, month DESC`;
            
            const monthlyData = await client.executeQuery(monthlyQuery);
            
            if (result && result.data && result.data.length > 0) {
                const stats = result.data[0];
                
                // Обновляем основную статистику
                document.getElementById('totalRecords').textContent = formatNumber(stats.total_records);
                document.getElementById('uniqueEdrpou').textContent = formatNumber(stats.unique_edrpou);
                document.getElementById('totalArea').textContent = formatArea(stats.total_area);
                document.getElementById('lastUpdate').textContent = formatDate(stats.last_update);
                document.getElementById('noUpdateDate').textContent = formatNumber(stats.no_update_date);
                
                // Группируем данные по годам и месяцам
                const yearlyData = {};
                monthlyData.data.forEach(row => {
                    const year = row.year;
                    const month = parseInt(row.month) - 1;
                    
                    if (!yearlyData[year]) {
                        yearlyData[year] = {
                            total: 0,
                            months: Array(12).fill(0)
                        };
                    }
                    yearlyData[year].total += row.count;
                    yearlyData[year].months[month] = row.count;
                });

                // Подготавливаем данные для графика
                const years = Object.keys(yearlyData);
                const monthNames = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 
                                  'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];

                // Создаем HTML для статистики
                const datesStats = document.getElementById('datesStats');
                if (datesStats) {
                    datesStats.innerHTML = `
                        <div class="card mt-3">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">Статистика оновлень</h5>
                                <select id="yearFilter" class="form-select form-select-sm" style="width: auto;">
                                    <option value="all">Всі роки</option>
                                    ${years.map(year => `<option value="${year}">${year} рік</option>`).join('')}
                                </select>
                            </div>
                            <div class="card-body">
                                <canvas id="updatesChart"></canvas>
                            </div>
                        </div>
                    `;

                    // Создаем фиксированную палитру цветов для годов
                    const yearColors = {
                        '2024': 'rgba(255, 99, 132, 0.7)',   // красный
                        '2023': 'rgba(54, 162, 235, 0.7)',   // синий
                        '2022': 'rgba(255, 206, 86, 0.7)',   // желтый
                        '2021': 'rgba(75, 192, 192, 0.7)',   // зеленый
                        '2020': 'rgba(153, 102, 255, 0.7)',  // фиолетовый
                        '2019': 'rgba(255, 159, 64, 0.7)',   // оранжевый
                        '2018': 'rgba(199, 199, 199, 0.7)',  // серый
                        '2017': 'rgba(83, 102, 255, 0.7)',   // индиго
                        '2016': 'rgba(255, 99, 255, 0.7)',   // розовый
                        '2015': 'rgba(159, 159, 64, 0.7)'    // оливковый
                    };

                    // Создаем график
                    const ctx = document.getElementById('updatesChart').getContext('2d');
                    const chart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: monthNames,
                            datasets: years.map(year => ({
                                label: year,
                                data: yearlyData[year].months,
                                backgroundColor: yearColors[year] || `hsla(${Math.random() * 360}, 70%, 50%, 0.7)`,
                                borderColor: yearColors[year]?.replace('0.7', '1') || `hsla(${Math.random() * 360}, 70%, 50%, 1)`,
                                borderWidth: 1,
                                hidden: false
                            }))
                        },
                        options: {
                            responsive: true,
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: value => formatNumber(value)
                                    }
                                }
                            },
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Кількість оновлень по місяцях'
                                },
                                tooltip: {
                                    callbacks: {
                                        label: context => `${context.dataset.label} рік: ${formatNumber(context.raw)} записів`
                                    }
                                },
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        usePointStyle: true,
                                        pointStyle: 'circle',
                                        padding: 15
                                    }
                                }
                            }
                        }
                    });

                    // Добавляем обработчик изменения года
                    document.getElementById('yearFilter').addEventListener('change', function(e) {
                        const selectedYear = e.target.value;
                        chart.data.datasets.forEach(dataset => {
                            if (selectedYear === 'all') {
                                dataset.hidden = false; // Показываем все при выборе "Все годы"
                            } else {
                                dataset.hidden = dataset.label !== selectedYear;
                            }
                        });
                        chart.update();
                    });

                    // По умолчанию показываем только последний год
                    const lastYear = years[0];
                    document.getElementById('yearFilter').value = lastYear;
                    chart.data.datasets.forEach(dataset => {
                        dataset.hidden = dataset.label !== lastYear;
                    });
                    chart.update();
                }
            }
        }
    } catch (error) {
        console.error('Помилка завантаження статистики:', error);
        document.querySelectorAll('#dbStats .h4').forEach(el => {
            el.textContent = 'Помилка';
            el.classList.add('text-danger');
        });
    }
}

// Вспомогательные функции форматирования
function formatNumber(num) {
    return new Intl.NumberFormat('uk-UA').format(num);
}

function formatArea(area) {
    if (!area) return '-';
    return `${formatNumber(Math.round(area * 100) / 100)} га`;
}

function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('uk-UA');
}

// Добавляем сохранение консольных ошибок
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = function() {
    saveLog(Array.from(arguments).join(' '), 'error');
    originalConsoleError.apply(this, arguments);
};

console.warn = function() {
    saveLog(Array.from(arguments).join(' '), 'warning');
    originalConsoleWarn.apply(this, arguments);
};

console.log = function() {
    saveLog(Array.from(arguments).join(' '), 'info');
    originalConsoleLog.apply(this, arguments);
}

// Добавляем функцию показа статистики
async function showImportSummary(stats) {
    const statsModal = new bootstrap.Modal(document.getElementById('statsModal'));
    const statsContent = document.querySelector('.stats-content');
    const importDetails = document.querySelector('.import-details');

    const duration = (stats.endTime - stats.startTime) / 1000;
    const speed = Math.round(stats.imported / duration);

    statsContent.innerHTML = `
        <div class="alert ${stats.failed > 0 ? 'alert-warning' : 'alert-success'}">
            <h5>Результати імпорту:</h5>
            <ul class="list-unstyled">
                <li>✓ Імпортовано записів: ${formatNumber(stats.imported)}</li>
                ${stats.failed > 0 ? `<li>⚠ Пропущено записів: ${formatNumber(stats.failed)}</li>` : ''}
                <li>⏱ Час виконання: ${formatTime(duration)}</li>
                <li>⚡ Швидкість: ${formatNumber(speed)} записів/с</li>
            </ul>
        </div>
    `;

    if (stats.skippedRecords && stats.skippedRecords.length > 0) {
        importDetails.innerHTML = `
            <h6>Деталі пропущених записів:</h6>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Кадастровий номер</th>
                            <th>Причина</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.skippedRecords.slice(0, 100).map((record, idx) => `
                            <tr>
                                <td>${record.row || idx + 1}</td>
                                <td>${record.cadnum || 'Не вказано'}</td>
                                <td><small class="text-danger">${record.reason}</small></td>
                            </tr>
                        `).join('')}
                        ${stats.skippedRecords.length > 100 ? `
                            <tr>
                                <td colspan="3" class="text-center">
                                    <small class="text-muted">...і ще ${stats.skippedRecords.length - 100} записів</small>
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        importDetails.innerHTML = '';
    }

    statsModal.show();
    return statsModal;
}

// Удаляем повторное определение класса AgroDBClient, так как он уже определен в agrodb-client.js

function getUpdateStatus(date_update) {
    if (!date_update) return { class: 'status-badge bg-secondary', text: 'Немає даних' };
    
    const updateDate = new Date(date_update);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - updateDate.getFullYear()) * 12 + 
                      (now.getMonth() - updateDate.getMonth());
    
    if (monthsDiff <= 1) {
        return { class: 'status-badge bg-success', text: 'Актуально' };
    } else if (monthsDiff <= 2) {
        return { class: 'status-badge bg-warning', text: '2 міс.' };
    } else {
        return { class: 'status-badge bg-danger', text: `${monthsDiff} міс.` };
    }
}

// Добавляем стили для бейджей
const style = document.createElement('style');
style.textContent = `
    .btn-group .btn .badge {
        font-size: 0.75rem;
        padding: 0.2em 0.4em;
    }
    .data-loaded-badge {
        background-color: #198754 !important;
    }
    .import-count-badge {
        background-color: #198754 !important;
    }
    .btn-group .btn.btn-light:not(:disabled),
    .btn-group .btn.btn-success:not(:disabled) {
        border-color: #fff;
        font-weight: 500;
    }
`;
document.head.appendChild(style);

// Добавляем стили для раскрывающихся строк
const expandableStyles = document.createElement('style');
expandableStyles.textContent = `
    .parent-row { cursor: pointer; }
    .parent-row:hover { background-color: rgba(0,0,0,.075); }
    .parent-row.expanded { background-color: rgba(0,0,0,.05); }
    .expand-btn { padding: 0; color: inherit; }
    .expand-btn:hover { color: inherit; }
    .details-row > td { padding: 0 !important; }
    .details-content { background-color: #f8f9fa; }
`;
document.head.appendChild(expandableStyles);
