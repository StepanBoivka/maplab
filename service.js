// Функції для роботи з кешем
function clearCache() {
    try {
        cacheManager.clear();
        refreshCacheInfo();
        logger.log('Кеш очищено');
        alert('Кеш успішно очищено');
    } catch (error) {
        logger.log(`Помилка очищення кешу: ${error.message}`, 'error');
        alert(`Помилка очищення кешу: ${error.message}`);
    }
}

function refreshCacheInfo() {
    const cacheInfo = cacheManager.getCacheInfo('parcels', {
        cadnum: null,
        filters: null
    });
    console.log('Cache info:', cacheInfo); // Логирование
    const cacheStats = document.getElementById('cacheStats');
    const cacheKeys = document.getElementById('cacheKeys');
    
    // Оновлюємо статистику кешу
    if (cacheStats) {
        cacheStats.innerHTML = `
            <h6>Статистика:</h6>
            <ul class="list-unstyled">
                <li>Розмір: ${cacheInfo.size}</li>
                <li>Кількість об'єктів: ${cacheInfo.items}</li>
                <li>Вік: ${cacheInfo.age || 'новий'}</li>
                <li>Закінчується: ${cacheInfo.expires || '-'}</li>
                <li>Валідний: ${cacheInfo.valid ? 'так' : 'ні'}</li>
            </ul>
        `;
    }

    // Оновлюємо список ключів
    if (cacheKeys) {
        const keys = Object.keys(localStorage)
            .filter(k => k.startsWith('ml3_'))
            .map(k => {
                const size = (localStorage.getItem(k).length * 2) / 1024; // в КБ
                return `${k} (${size.toFixed(2)} KB)`;
            });

        cacheKeys.innerHTML = `
            <h6>Ключі кешу:</h6>
            <ul class="list-unstyled">
                ${keys.length ? keys.map(k => `<li>${k}</li>`).join('') : '<li>Кеш пустий</li>'}
            </ul>
        `;
    }
}

// Создаем глобальный класс для логгера
if (typeof SystemLogger === 'undefined') {
    var SystemLogger = class {
        constructor(maxLogs = 100) {
            this.maxLogs = maxLogs;
            this.storageKey = 'ml3_system_logs';
        }

        log(message, type = 'info') {
            const logs = this.getLogs();
            const timestamp = new Date().toISOString();
            logs.unshift({ timestamp, message, type });
            
            if (logs.length > this.maxLogs) {
                logs.pop();
            }
            
            localStorage.setItem(this.storageKey, JSON.stringify(logs));
            this.updateLogsDisplay();
        }

        getLogs() {
            const logs = localStorage.getItem(this.storageKey);
            return logs ? JSON.parse(logs) : [];
        }

        clear() {
            localStorage.removeItem(this.storageKey);
            this.updateLogsDisplay();
        }

        updateLogsDisplay() {
            const logsElement = document.getElementById('systemLogs');
            if (logsElement) {
                const logs = this.getLogs();
                logsElement.innerHTML = logs.length ? 
                    logs.map(log => 
                        `<div class="log-entry ${log.type}">
                            [${new Date(log.timestamp).toLocaleString()}] ${log.type.toUpperCase()}: ${log.message}
                        </div>`
                    ).join('\n')
                    : 'Логи відсутні';
            }
        }
    };
}

// Создаем глобальный экземпляр логгера
if (typeof logger === 'undefined') {
    var logger = new SystemLogger();
}

// Функції інтерфейсу
function clearLogs() {
    try {
        logger.clear();
        alert('Логи очищено');
    } catch (error) {
        console.error('Помилка очищення логів:', error);
        alert('Помилка очищення логів');
    }
}

function updateSystemInfo() {
    const systemInfo = document.getElementById('systemInfo');
    if (!systemInfo) return;

    const info = {
        browser: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            cookies: navigator.cookieEnabled,
            localStorage: !!window.localStorage
        },
        screen: {
            width: window.screen.width,
            height: window.screen.height,
            pixelRatio: window.devicePixelRatio
        },
        system: {
            platform: navigator.platform,
            cores: navigator.hardwareConcurrency,
            memory: navigator.deviceMemory
        }
    };

    systemInfo.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Браузер:</h6>
                <ul class="list-unstyled">
                    <li>User Agent: ${info.browser.userAgent}</li>
                    <li>Мова: ${info.browser.language}</li>
                    <li>Cookies: ${info.browser.cookies ? 'включені' : 'виключені'}</li>
                    <li>LocalStorage: ${info.browser.localStorage ? 'доступний' : 'недоступний'}</li>
                </ul>
            </div>
            <div class="col-md-6">
                <h6>Система:</h6>
                <ul class="list-unstyled">
                    <li>Платформа: ${info.system.platform}</li>
                    <li>Ядра CPU: ${info.system.cores || 'невідомо'}</li>
                    <li>Екран: ${info.screen.width}x${info.screen.height} (${info.screen.pixelRatio}x)</li>
                </ul>
            </div>
        </div>
    `;
}

// Ініціалізація при завантаженні
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    refreshCacheInfo();
    updateSystemInfo();
    logger.updateLogsDisplay();
    
    // Оновлюємо інформацію кожну хвилину
    setInterval(refreshCacheInfo, 60000);
});

// Перевірка авторизації
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement && session.user) {
        userEmailElement.textContent = session.user.email;
    }
}

// Функція виходу
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'index.html';
    } catch (error) {
        logger.log(`Помилка виходу: ${error.message}`, 'error');
        alert(`Помилка виходу: ${error.message}`);
    }
}
