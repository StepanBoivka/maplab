class AgroDBClient {
    constructor(baseUrl = "http://localhost:5000/api") {
        this.baseUrl = baseUrl;
        this.isConnected = false;
    }

    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/tables`, {
                method: "GET",
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(3000) // таймаут 3 секунды
            });
            this.isConnected = response.ok;
            return response.ok;
        } catch (error) {
            this.isConnected = false;
            throw error;
        }
    }

    async getTables() {
        try {
            const response = await fetch(`${this.baseUrl}/tables`);
            if (!response.ok) throw new Error('Не удалось получить список таблиц');
            const data = await response.json();
            return data.tables || [];
        } catch (error) {
            throw new Error(`Ошибка получения списка таблиц: ${error.message}`);
        }
    }

    async getTableData(tableName, limit = 100, offset = 0) {
        try {
            if (tableName !== 'dzk_get') {
                throw new Error('Доступна только таблица dzk_get');
            }

            const response = await fetch(
                `${this.baseUrl}/data/${tableName}?limit=${limit}&offset=${offset}`
            );
            
            if (!response.ok) throw new Error('Не удалось получить данные таблицы');
            
            const data = await response.json();
            console.log('Received data:', data); // Отладочный вывод
            
            // Возвращаем данные без дополнительной обработки
            return {
                rows: data
            };
        } catch (error) {
            console.error('Raw error:', error);
            throw new Error(`Ошибка получения данных DZK: ${error.message}`);
        }
    }

    async importDzkData(data) {
        try {
            console.log('Sending batch:', data.length, 'records');
            
            const response = await fetch(`${this.baseUrl}/data/dzk_get/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            console.log('Server response:', result);
            
            if (!response.ok) {
                throw new Error(result.error || 'Помилка імпорту даних');
            }
            
            if (result.errors && result.errors.length > 0) {
                console.warn('Import warnings:', result.errors);
            }
            
            return result;
        } catch (error) {
            console.error('Import error details:', error);
            throw new Error(`Помилка імпорту даних: ${error.message}`);
        }
    }

    async getTableSchema(tableName) {
        try {
            const response = await fetch(`${this.baseUrl}/schema/${tableName}`);
            if (!response.ok) throw new Error('Не удалось получить схему таблицы');
            const data = await response.json();
            return data.schema;
        } catch (error) {
            throw new Error(`Ошибка получения схемы таблицы: ${error.message}`);
        }
    }

    async executeQuery(query) {
        try {
            // Если query - это строка, оборачиваем её в объект
            const queryData = typeof query === 'string' ? { query } : query;
            
            const response = await fetch(`${this.baseUrl}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(queryData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Не вдалося виконати запит');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Query error:', error);
            throw new Error(`Помилка виконання запиту: ${error.message}`);
        }
    }
}