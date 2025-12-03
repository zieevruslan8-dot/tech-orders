// Основное приложение ТехноАггрегатора
console.log('🚜 Tech Orders Platform loaded');

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ App.js: Инициализация...');
    
    // Проверяем авторизацию
    checkAuthStatus();
    
    // Инициализация форм
    initForms();
    
    // Настраиваем кнопки
    setupButtons();
});

// Проверка статуса авторизации
async function checkAuthStatus() {
    try {
        const { data } = await supabaseClient.auth.getSession();
        if (data.session) {
            console.log('✅ Пользователь авторизован:', data.session.user.email);
            // UI обновится автоматически через supabase-config.js
        } else {
            console.log('ℹ️ Пользователь не авторизован');
        }
    } catch (error) {
        console.error('❌ Ошибка проверки авторизации:', error);
    }
}

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
                const role = new URL(url).searchParams.get('role');
                if (role) {
                    sessionStorage.setItem('preferred_role', role);
                    console.log('🎯 Выбрана роль:', role);
                }
                window.location.href = url;
            });
        });
    }
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

// Получение текущего пользователя
function getCurrentUser() {
    const email = localStorage.getItem('user_email');
    const id = localStorage.getItem('user_id');
    return email ? { email, id } : null;
}

// Глобальные функции для использования в других местах
window.getCurrentUser = getCurrentUser;
window.handleQuickSearch = handleQuickSearch;

console.log('✅ App.js загружен и готов к работе');
