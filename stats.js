// Инициализация Supabase
let supabase;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (typeof initializeSupabase === 'function') {
            supabase = initializeSupabase();
            console.log('Supabase успешно инициализирован');
            
            // Проверяем авторизацию
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                window.location.href = 'index.html';
                return;
            }

            // Показываем email пользователя
            document.getElementById('userEmail').textContent = user.email;
            
            // Загружаем статистику
            await loadStatusStatistics();
            
        } else {
            console.error('Функция initializeSupabase не найдена');
        }
    } catch (err) {
        console.error('Ошибка инициализации:', err);
    }
});

async function loadStatusStatistics() {
    try {
        const { data, error } = await supabase.rpc('count_contractors_by_status');

        if (error) {
            console.error('Error fetching status statistics:', error);
            return;
        }

        // Фильтруем и сортируем данные
        const filteredData = data
            .filter(item => item.status_name)
            .sort((a, b) => b.count_value - a.count_value);

        const labels = filteredData.map(item => item.status_name);
        const counts = filteredData.map(item => item.count_value);
        const total = counts.reduce((sum, count) => sum + count, 0);
        const percentages = counts.map(count => ((count / total) * 100).toFixed(1));

        // Определяем цвета для каждой полосы
        const backgroundColor = labels.map(label => 
            label === 'Клієнт' ? '#dc3545' : '#3ECF8E'
        );

        const borderColor = labels.map(label => 
            label === 'Клієнт' ? '#b02a37' : '#2EBF7E'
        );

        // Создаем график
        const ctx = document.getElementById('statusChart').getContext('2d');
        const statusChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Кількість клієнтів',
                    data: counts,
                    backgroundColor: backgroundColor,
                    borderColor: borderColor,
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const index = context.dataIndex;
                                return `${counts[index]} клієнтів (${percentages[index]}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: true,
                            drawBorder: false,
                            color: '#E5E5E5'
                        },
                        title: {
                            display: true,
                            text: 'Кількість клієнтів',
                            font: {
                                size: 14
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        }
                    }
                },
                layout: {
                    padding: {
                        right: 50 // Добавляем отступ справа для меток
                    }
                },
                plugins: {
                    // Плагин для отображения значений на полосах
                    datalabels: {
                        anchor: 'end',
                        align: 'right',
                        formatter: function(value, context) {
                            return `${value} (${percentages[context.dataIndex]}%)`;
                        },
                        color: '#666',
                        font: {
                            size: 12
                        },
                        padding: {
                            right: 6
                        }
                    }
                }
            },
            plugins: [ChartDataLabels] // Подключаем плагин
        });

    } catch (err) {
        console.error('Error in loadStatusStatistics:', err);
    }
}

// Функция выхода
function signOut() {
    if (supabase) {
        supabase.auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}

window.signOut = signOut;
