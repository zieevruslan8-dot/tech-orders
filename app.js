// Основное приложение ТехноАггрегатора
console.log('🚜 Tech Orders Platform loaded');

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ App.js: Инициализация...');
    
    // Проверяем авторизацию и обновляем профиль
    checkAuthAndUpdateProfile();
    
    // Инициализация форм
    initForms();
    
    // Настраиваем кнопки
    setupButtons();
});

// Проверка статуса авторизации и обновление профиля
async function checkAuthAndUpdateProfile() {
    try {
        const { data } = await supabaseClient.auth.getSession();
        if (data.session) {
            console.log('✅ Пользователь авторизован:', data.session.user.email);
            
            // Автоматически создаём/обновляем профиль
            await ensureUserProfile(data.session.user);
            
            // UI обновится автоматически через supabase-config.js
        } else {
            console.log('ℹ️ Пользователь не авторизован');
        }
    } catch (error) {
        console.error('❌ Ошибка проверки авторизации:', error);
    }
}

// Создание/обновление профиля пользователя
async function ensureUserProfile(user) {
    try {
        if (!user) return;
        
        // Получаем данные пользователя
        const role = user.user_metadata?.role || localStorage.getItem('user_role') || 'client';
        const firstName = user.user_metadata?.first_name || localStorage.getItem('user_name') || user.email?.split('@')[0] || 'Пользователь';
        
        // Обновляем профиль в базе
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
                id: user.id,
                email: user.email,
                first_name: firstName,
                role: role,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id'
            });
        
        if (profileError) {
            console.warn('⚠️ Ошибка обновления профиля:', profileError);
        } else {
            console.log('✅ Профиль обновлён:', { email: user.email, role });
        }
        
        // Сохраняем в localStorage для быстрого доступа
        localStorage.setItem('user_role', role);
        localStorage.setItem('user_email', user.email);
        localStorage.setItem('user_name', firstName);
        localStorage.setItem('user_id', user.id);
        localStorage.setItem('last_login', new Date().toISOString());
        
    } catch (error) {
        console.error('❌ Ошибка создания профиля:', error);
    }
}

// Слушатель изменений состояния авторизации
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('🔄 Auth state changed:', event);
    
    if (session?.user) {
        await ensureUserProfile(session.user);
        
        // Автоматическое перенаправление на нужный дашборд
        if (event === 'SIGNED_IN') {
            const role = session.user.user_metadata?.role || localStorage.getItem('user_role') || 'client';
            const currentPath = window.location.pathname;
            
            // Не перенаправляем, если уже на нужной странице
            if (role === 'client' && !currentPath.includes('client/dashboard.html') && currentPath.includes('auth/')) {
                setTimeout(() => window.location.href = '/pages/client/dashboard.html', 500);
            }
        }
    }
});

// Инициализация форм
function initForms() {
    console.log('🔧 Инициализация форм...');
    
    // Находим форму быстрого поиска
    const searchBtn = document.querySelector('.quick-order-form .btn-primary');
    if (searchBtn) {
        console.log('✅ Найдена кнопка поиска');
        searchBtn.addEventListener('click', handleQuickSearch);
    }
    
    // Кнопки регистрации по ролям
    const roleButtons = document.querySelectorAll('.role-card .btn');
    if (roleButtons.length > 0) {
        console.log('✅ Найдены кнопки регистрации:', roleButtons.length);
        roleButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const url = this.href;
                const role = new URL(url, window.location.origin).searchParams.get('role');
                if (role) {
                    sessionStorage.setItem('preferred_role', role);
                    console.log('🎯 Выбрана роль:', role);
                }
                window.location.href = url;
            });
        });
    }
    
    // Кнопки выхода
    const logoutButtons = document.querySelectorAll('[onclick*="logout"]');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            await logoutUser();
        });
    });
}

// Настройка кнопок
function setupButtons() {
    // Кнопки навигации
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            console.log('🔗 Переход по ссылке:', this.href);
        });
    });
}

// Обработка быстрого поиска
function handleQuickSearch() {
    console.log('🔍 Обработка быстрого поиска...');
    
    const techType = document.getElementById('tech-type');
    const location = document.getElementById('location');
    
    if (!techType || !location) {
        console.warn('❌ Не найдены поля поиска');
        return;
    }
    
    const techValue = techType.value;
    const locationValue = location.value;
    
    console.log('📋 Параметры поиска:', { techValue, locationValue });
    
    if (!techValue || !locationValue) {
        alert('Пожалуйста, заполните тип техники и местоположение');
        return;
    }
    
    // Сохраняем параметры поиска
    sessionStorage.setItem('search_tech_type', techValue);
    sessionStorage.setItem('search_location', locationValue);
    console.log('💾 Параметры сохранены в sessionStorage');
    
    // Проверяем авторизацию
    const userEmail = localStorage.getItem('user_email');
    
    if (userEmail) {
        console.log('✅ Пользователь авторизован, перенаправляем на создание заказа');
        window.location.href = '/pages/orders/create.html';
    } else {
        console.log('❌ Пользователь не авторизован, перенаправляем на регистрацию');
        window.location.href = '/pages/auth/register.html?action=quick_order';
    }
}

// Функция выхода
async function logoutUser() {
    try {
        await supabaseClient.auth.signOut();
        
        // Очищаем localStorage (кроме предпочтений)
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_id');
        localStorage.removeItem('last_login');
        
        // Сохраняем роль для будущего входа
        const savedRole = localStorage.getItem('user_role');
        localStorage.clear();
        if (savedRole) localStorage.setItem('user_role', savedRole);
        
        console.log('✅ Выход выполнен');
        
        // Перенаправляем на главную
        window.location.href = '/index.html';
        
    } catch (error) {
        console.error('❌ Ошибка при выходе:', error);
        alert('Ошибка при выходе: ' + error.message);
    }
}

// Получение текущего пользователя
function getCurrentUser() {
    const email = localStorage.getItem('user_email');
    const id = localStorage.getItem('user_id');
    const name = localStorage.getItem('user_name');
    const role = localStorage.getItem('user_role');
    
    return email ? { 
        email, 
        id, 
        name,
        role 
    } : null;
}

// Получение роли пользователя
function getUserRole() {
    return localStorage.getItem('user_role') || 'client';
}

// Проверка роли пользователя
function checkUserRole(requiredRole) {
    const userRole = getUserRole();
    return userRole === requiredRole;
}

// Перенаправление по роли
function redirectByRole(role) {
    const rolePaths = {
        'client': '/pages/client/dashboard.html',
        'driver': '/pages/driver/dashboard.html',
        'fleet': '/pages/fleet/dashboard.html'
    };
    
    const path = rolePaths[role] || '/pages/client/dashboard.html';
    
    // Проверяем, не находимся ли уже на нужной странице
    if (!window.location.pathname.includes(path)) {
        window.location.href = path;
    }
}

// Вспомогательная функция для показа уведомлений
function showNotification(message, type = 'success') {
    const colors = {
        'success': '#2ecc71',
        'error': '#e74c3c',
        'info': '#3498db',
        'warning': '#f39c12'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Анимация
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Глобальные функции для использования в других местах
window.getCurrentUser = getCurrentUser;
window.getUserRole = getUserRole;
window.checkUserRole = checkUserRole;
window.redirectByRole = redirectByRole;
window.handleQuickSearch = handleQuickSearch;
window.logoutUser = logoutUser;
window.showNotification = showNotification;

console.log('✅ App.js загружен и готов к работе');
