// ============================================
// SUPABASE КОНФИГУРАЦИЯ ДЛЯ ТЕХНОАГГРЕГАТОРА
// ============================================

// ВАШИ РЕАЛЬНЫЕ КЛЮЧИ:
const SUPABASE_URL = 'https://wibdwaxzthzcdfgiicuv.supabase.co';  // Ваш Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYmR3YXh6dGh6Y2RmZ2lpY3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Mjg3MzAsImV4cCI6MjA4MDMwNDczMH0.uYq6h9Shp2x2hV7XPwEL1V0QUTLnWes5vTD4yFLTZl0';  // Ваш anon public key

// Инициализация Supabase клиента
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// ОБРАБОТКА АВТОРИЗАЦИИ
// ============================================

// Следим за изменением состояния авторизации
supabase.auth.onAuthStateChange((event, session) => {
    console.log(`🔐 Событие авторизации: ${event}`);
    
    if (session) {
        // Пользователь вошел в систему
        console.log('✅ Пользователь авторизован:', session.user.email);
        
        // Сохраняем данные в localStorage
        localStorage.setItem('auth_token', session.access_token);
        localStorage.setItem('user_id', session.user.id);
        localStorage.setItem('user_email', session.user.email);
        localStorage.setItem('user_role', session.user.user_metadata?.role || 'client');
        
        // Загружаем полный профиль пользователя
        loadUserProfile(session.user.id);
        
        // Обновляем интерфейс
        updateAuthUI(true, session.user);
        
        // Перенаправляем если нужно
        handleAuthRedirect(session.user);
        
    } else {
        // Пользователь вышел из системы
        console.log('❌ Пользователь не авторизован');
        
        // Очищаем localStorage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_profile');
        
        // Обновляем интерфейс
        updateAuthUI(false);
    }
});

// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ПОЛЬЗОВАТЕЛЯМИ
// ============================================

// Загрузка профиля пользователя из таблицы profiles
async function loadUserProfile(userId) {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        
        if (profile) {
            localStorage.setItem('user_profile', JSON.stringify(profile));
            console.log('📋 Профиль загружен:', profile);
            return profile;
        }
    } catch (error) {
        console.warn('⚠️ Не удалось загрузить профиль:', error.message);
    }
    return null;
}

// Получение текущего пользователя
function getCurrentUser() {
    const userData = localStorage.getItem('user_profile');
    return userData ? JSON.parse(userData) : null;
}

// Проверка роли пользователя
function checkUserRole(requiredRole) {
    const user = getCurrentUser();
    if (!user) return false;
    
    // Если требуется массив ролей
    if (Array.isArray(requiredRole)) {
        return requiredRole.includes(user.role);
    }
    
    // Если требуется одна роль
    return user.role === requiredRole;
}

// ============================================
// ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ИНТЕРФЕЙСА
// ============================================

// Обновление UI в зависимости от авторизации
function updateAuthUI(isLoggedIn, user = null) {
    // Находим все элементы с классами для авторизации
    const loggedOutElements = document.querySelectorAll('.logged-out, [data-auth="logged-out"]');
    const loggedInElements = document.querySelectorAll('.logged-in, [data-auth="logged-in"]');
    const userEmailElements = document.querySelectorAll('.user-email, [data-user-email]');
    const userNameElements = document.querySelectorAll('.user-name, [data-user-name]');
    
    if (isLoggedIn) {
        // Показываем элементы для авторизованных, скрываем для неавторизованных
        loggedOutElements.forEach(el => el.style.display = 'none');
        loggedInElements.forEach(el => el.style.display = '');
        
        // Обновляем информацию о пользователе
        if (user) {
            userEmailElements.forEach(el => {
                el.textContent = user.email;
                el.title = user.email;
            });
            
            // Пытаемся получить имя из профиля
            const profile = getCurrentUser();
            const userName = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
            
            userNameElements.forEach(el => {
                el.textContent = userName;
                el.title = userName;
            });
        }
        
    } else {
        // Показываем элементы для неавторизованных, скрываем для авторизованных
        loggedOutElements.forEach(el => el.style.display = '');
        loggedInElements.forEach(el => el.style.display = 'none');
    }
}

// Перенаправление после авторизации
function handleAuthRedirect(user) {
    const currentPath = window.location.pathname;
    
    // Если мы на странице входа/регистрации - перенаправляем в ЛК
    if (currentPath.includes('/auth/')) {
        const role = user.user_metadata?.role || 'client';
        const dashboardPaths = {
            'client': '/pages/client/dashboard.html',
            'driver': '/pages/driver/dashboard.html',
            'fleet_admin': '/pages/fleet/dashboard.html',
            'fleet_dispatcher': '/pages/fleet/dashboard.html',
            'system_admin': '/pages/admin/dashboard.html',
            'system_moderator': '/pages/admin/dashboard.html',
            'system_support': '/pages/admin/dashboard.html'
        };
        
        const redirectPath = dashboardPaths[role] || '/pages/client/dashboard.html';
        
        // Ждем 1 секунду перед редиректом
        setTimeout(() => {
            if (window.location.pathname.includes('/auth/')) {
                window.location.href = redirectPath;
            }
        }, 1000);
    }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// Проверка доступности Supabase
async function checkSupabaseConnection() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        console.log('✅ Подключение к Supabase: УСПЕХ');
        return true;
    } catch (error) {
        console.error('❌ Ошибка подключения к Supabase:', error.message);
        return false;
    }
}

// Выход из системы
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Очищаем localStorage
        localStorage.clear();
        
        // Обновляем UI
        updateAuthUI(false);
        
        // Перенаправляем на главную
        window.location.href = '/';
        
        console.log('✅ Успешный выход из системы');
    } catch (error) {
        console.error('❌ Ошибка выхода:', error.message);
        alert('Ошибка выхода из системы: ' + error.message);
    }
}

// ============================================
// ЭКСПОРТ ФУНКЦИЙ ДЛЯ ГЛОБАЛЬНОГО ИСПОЛЬЗОВАНИЯ
// ============================================

window.supabaseClient = supabase;
window.updateAuthUI = updateAuthUI;
window.getCurrentUser = getCurrentUser;
window.checkUserRole = checkUserRole;
window.logout = logout;

// ============================================
// АВТОМАТИЧЕСКАЯ ПРОВЕРКА ПРИ ЗАГРУЗКЕ
// ============================================

// Проверяем подключение при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚜 Tech Orders Platform: Загрузка конфигурации Supabase...');
    
    // Проверяем подключение
    const isConnected = await checkSupabaseConnection();
    
    if (isConnected) {
        // Проверяем текущую сессию
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            console.log('✅ Автоматически обнаружена активная сессия');
            // Событие onAuthStateChange само обновит UI
        } else {
            console.log('ℹ️ Активная сессия не обнаружена');
            updateAuthUI(false);
        }
    } else {
        console.error('❌ Критическая ошибка: Нет подключения к Supabase');
        // Можно показать сообщение пользователю
        if (document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'background: #ff4444; color: white; padding: 10px; text-align: center;';
            errorDiv.textContent = 'Ошибка подключения к базе данных. Пожалуйста, обновите страницу.';
            document.body.prepend(errorDiv);
        }
    }
    
    console.log('✅ Supabase конфигурация загружена и готова к работе');
    console.log('🌐 Supabase URL:', SUPABASE_URL);
});

// ============================================
// ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
// ============================================

// Перехват ошибок Supabase
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        console.log('👋 Пользователь вышел из системы');
    } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Токен обновлен');
    } else if (event === 'USER_UPDATED') {
        console.log('📝 Данные пользователя обновлены');
    }
});

console.log('🎯 Supabase конфигурация инициализирована');
console.log('🔑 Используется проект:', SUPABASE_URL);
