async function loadDashboardData(selectedCoatuu = '') {
    document.body.classList.add('loading');
    try {
        const { data, error } = await supabase
            .rpc('get_parcels_with_coatuu');
            
        if (error) throw error;
        
        let filteredData = data;
        if (selectedCoatuu) {
            filteredData = data.filter(d => d.namecoatuu === selectedCoatuu);
        }
        
        updateDashboardStats(filteredData);
    } catch (error) {
        console.error('Помилка завантаження даних:', error);
    } finally {
        document.body.classList.remove('loading');
    }
}

// Обновляем обработчик события изменения dropdown
document.getElementById('coatuuDropdown').addEventListener('change', function(e) {
    loadDashboardData(e.target.value);
});
