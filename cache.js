// Проверяем, не объявлены ли уже константы и классы
if (typeof CACHE_EXPIRATION === 'undefined') {
    var CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 години в мілісекундах
}

if (typeof CacheManager === 'undefined') {
    var CacheManager = class {
        constructor(prefix = 'ml3_') {
            this.prefix = prefix;
        }

        // Генерує ключ для кешу
        getKey(key, params = {}) {
            return this.prefix + key + '_' + JSON.stringify(params);
        }

        // Зберігає дані в кеш
        set(key, data, params = {}) {
            const cacheKey = this.getKey(key, params);
            const cacheData = {
                timestamp: Date.now(),
                data: data
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        }

        // Отримує дані з кешу
        get(key, params = {}) {
            const cacheKey = this.getKey(key, params);
            const cached = localStorage.getItem(cacheKey);
            
            if (!cached) return null;
            
            const cacheData = JSON.parse(cached);
            
            // Перевіряємо чи не застарів кеш
            if (Date.now() - cacheData.timestamp > CACHE_EXPIRATION) {
                localStorage.removeItem(cacheKey);
                return null;
            }
            
            return cacheData.data;
        }

        // Очищує кеш
        clear(key = null, params = {}) {
            if (key) {
                const cacheKey = this.getKey(key, params);
                localStorage.removeItem(cacheKey);
            } else {
                // Очищуємо весь кеш з нашим префіксом
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith(this.prefix)) {
                        localStorage.removeItem(key);
                    }
                }
            }
        }

        // Перевіряє наявність актуального кешу
        isValid(key, params = {}) {
            const cached = this.get(key, params);
            return cached !== null;
        }

        // Додаємо новий метод для отримання віку кешу
        getCacheAge(key, params = {}) {
            const cacheKey = this.getKey(key, params);
            const cached = localStorage.getItem(cacheKey);
            
            if (!cached) return null;
            
            const cacheData = JSON.parse(cached);
            const ageInMs = Date.now() - cacheData.timestamp;
            const ageInHours = Math.round(ageInMs / (1000 * 60 * 60));
            
            return ageInHours;
        }

        // Додаємо метод для отримання розміру кешу
        getCacheSize() {
            let totalSize = 0;
            let items = 0;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(this.prefix)) {
                    const item = localStorage.getItem(key);
                    totalSize += item.length * 2; // в байтах (2 байти на символ)
                    items++;
                }
            }

            return {
                bytes: totalSize,
                items: items,
                readable: this.formatBytes(totalSize)
            };
        }

        // Форматування розміру в читабельний вигляд
        formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        // Додаємо метод для отримання детальної інформації про кеш
        getCacheInfo(key, params = {}) {
            const age = this.getCacheAge(key, params);
            const size = this.getCacheSize();
            const isValid = this.isValid(key, params);
            
            return {
                age: age ? `${age} год` : null,
                size: size.readable,
                items: size.items,
                valid: isValid,
                expires: age ? `через ${24 - age} год` : null
            };
        }
    }
}

// Создаем экземпляр только если его еще нет
if (typeof cacheManager === 'undefined') {
    var cacheManager = new CacheManager();
}
