async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    const authSection = document.getElementById('auth-section');
    const mainContent = document.getElementById('main-content');
    const userEmailElement = document.getElementById('userEmail');
    
    if (session) {
        authSection.style.display = 'none';
        mainContent.style.display = 'block';
        
        if (userEmailElement) {
            userEmailElement.textContent = session.user.email;
        }
        
        await loadUserPermissions();
    } else {
        authSection.style.display = 'block';
        mainContent.style.display = 'none';
    }
}

async function loadUserPermissions() {
    try {
        const { data: permissions, error } = await supabase
            .from('user_permissions')
            .select('namecoatuu');
            
        if (error) throw error;
        
        updateCoatuuDropdown(permissions);
        loadDashboardData();
    } catch (error) {
        console.error('Помилка завантаження прав доступу:', error);
    }
}

function updateCoatuuDropdown(permissions) {
    const dropdown = document.getElementById('coatuuDropdown');
    dropdown.innerHTML = '<option value="">Всі доступні ради</option>';
    
    permissions.forEach(p => {
        const option = document.createElement('option');
        option.value = p.namecoatuu;
        option.textContent = p.namecoatuu;
        dropdown.appendChild(option);
    });
}
