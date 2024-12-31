// Зберігаємо історію логів в localStorage
class SystemLogger {
    constructor(maxLogs = 100) {
        this.maxLogs = maxLogs;
        this.storageKey = 'ml3_system_logs';
    }

    log(message, type = 'info') {
        const logs = this.getLogs();
        const timestamp = new Date().toISOString();
        logs.unshift({ timestamp, message, type });
        
        // Обмежуємо кількість логів
        if (logs.length > this.maxLogs) {
            logs.pop();
        }
        
        localStorage.setItem(this.storageKey, JSON.stringify(logs));
    }

    getLogs() {
        const logs = localStorage.getItem(this.storageKey);
        return logs ? JSON.parse(logs) : [];
    }

    clear() {
        localStorage.removeItem(this.storageKey);
    }
}

const logger = new SystemLogger();

// Функції для роботи з інтерфейсом
function refreshCacheInfo() {
    const cacheInfo = cacheManager.getCacheInfo('parcels');
    const cacheStats = document.getElementById('cacheStats');
    const cacheKeys = document.getElementById('cacheKeys');
    
    // Оновлюємо статистику кешу
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

    // Оновлюємо список ключів
    const keys = Object.keys(localStorage)
        .filter(k => k.startsWith('ml3_'))
        .map(k => {
            const size = (localStorage.getItem(k).length * 2) / 1024; // в КБ
            return `${k} (${size.toFixed(2)} KB)`;
        });

    cacheKeys.innerHTML = `
        <h6>Ключі кешу:</h6>
        <ul class="list-unstyled">
            ${keys.map(k => `<li>${k}</li>`).join('')}
        </ul>
    `;

    logger.log('Оновлено інформацію про кеш');
}

function updateSystemInfo() {
    const systemInfo = document.getElementById('systemInfo');
    
    // Збираємо системну інформацію
    const info = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled,
        localStorage: {
            available: !!window.localStorage,
            totalSpace: cacheManager.getCacheSize().readable
        },
        screen: {
            width: window.screen.width,
            height: window.screen.height,
            pixelRatio: window.devicePixelRatio
        },
        connection: navigator.connection ? {
            type: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink
        } : 'N/A'
    };

    systemInfo.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Браузер:</h6>
                <ul class="list-unstyled">
                    <li>User Agent: ${info.userAgent}</li>
                    <li>Мова: ${info.language}</li>
                    <li>Платформа: ${info.platform}</li>
                    <li>Cookies: ${info.cookiesEnabled ? 'включені' : 'виключені'}</li>
                </ul>
            </div>
            <div class="col-md-6">
                <h6>Система:</h6>
                <ul class="list-unstyled">
                    <li>Екран: ${info.screen.width}x${info.screen.height}</li>
                    <li>Pixel Ratio: ${info.screen.pixelRatio}</li>
                    <li>localStorage: ${info.localStorage.totalSpace}</li>
                    <li>Підключення: ${JSON.stringify(info.connection)}</li>
                </ul>
            </div>
        </div>
    `;
}

function updateLogs() {
    const logsElement = document.getElementById('systemLogs');
    const logs = logger.getLogs();
    
    logsElement.innerHTML = logs.map(log => 
        `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`
    ).join('\n');
}

function clearLogs() {
    logger.clear();
    updateLogs();
}

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    refreshCacheInfo();
    updateSystemInfo();
    updateLogs();
    
    // Оновлюємо інформацію кожну хвилину
    setInterval(refreshCacheInfo, 60000);
});

// Функція для виходу
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
