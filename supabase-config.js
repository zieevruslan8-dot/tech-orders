// ============================================
// SUPABASE КОНФИГУРАЦИЯ ДЛЯ ТЕХНОАГГРЕГАТОРА
// ============================================

// ВАШИ РЕАЛЬНЫЕ КЛЮЧИ:
const SUPABASE_URL = 'https://wibdwaxzthzcdfgiicuv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYmR3YXh6dGh6Y2RmZ2lpY3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Mjg3MzAsImV4cCI6MjA4MDMwNDczMH0.uYq6h9Shp2x2hV7XPwEL1V0QUTLnWes5vTD4yFLTZl0';

// Безопасное хранилище (без запросов уведомлений)
const storage = {
    setItem: (key, value) => {
        try {
            if (key.includes('token') || key.includes('auth')) {
                sessionStorage.setItem(key, value);
            } else {
                localStorage.setItem(key, value);
            }
        } catch (e) {
            console.warn('⚠️ Ошибка сохранения:', e);
        }
    },
    
    getItem: (key) => {
        try {
            return sessionStorage.getItem(key) || localStorage.getItem(key);
        } catch (e) {
            console.warn('⚠️ Ошибка чтения:', e);
            return null;
        }
    },
    
    removeItem: (key) => {
        try {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('⚠️ Ошибка удаления:', e);
        }
    },
    
    clear: () => {
        try {
            sessionStorage.clear();
            localStorage.clear();
        } catch (e) {
            console.warn('⚠️ Ошибка очистки:', e);
        }
    }
};

// Инициализация Supabase клиента
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// ============================================
// ОБРАБОТКА АВТОРИЗАЦИИ
// ============================================

// Следим за изменением состояния авторизации
supabase.auth.onAuthStateChange((event, session) => {
    console.log(`🔐 Событие авторизации: ${event}`);
    
    if (session) {
        console.log('✅ Пользователь авторизован:', session.user.email);
        
        // Сохраняем данные
        storage.setItem('auth_token', session.access_token);
        storage.setItem('user_id', session.user.id);
        storage.setItem('user_email', session.user.email);
        storage.setItem('user_role', session.user.user_metadata?.role || 'client');
        
        // Загружаем профиль
        loadUserProfile(session.user.id);
        
        // Обновляем интерфейс
        updateAuthUI(true, session.user);
        
        // Перенаправляем если нужно
        handleAuthRedirect(session.user);
        
    } else {
        console.log('❌ Пользователь не авторизован');
        storage.clear();
        updateAuthUI(false);
    }
});

// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ПОЛЬЗОВАТЕЛЯМИ
// ============================================

// Создание профиля по умолчанию
async function createDefaultProfile(userId) {
    try {
        const { data: userData } = await supabase.auth.getUser();
        
        const newProfile = {
            id: userId,
            email: userData.user.email,
            full_name: userData.user.user_metadata?.full_name || userData.user.email.split('@')[0],
            role: userData.user.user_metadata?.role || 'client',
            phone: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
            .from('profiles')
            .upsert([newProfile]);
            
        if (error) throw error;
        
        console.log('✅ Профиль создан');
        return newProfile;
    } catch (error) {
        console.error('❌ Ошибка создания профиля:', error);
        return null;
    }
}

// Загрузка профиля пользователя
async function loadUserProfile(userId) {
    try {
        // Проверяем существование таблицы
        const { data: tableCheck, error: tableError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);
            
        if (tableError && tableError.code === '42P01') {
            console.log('⚠️ Таблица profiles не существует');
            // Таблицы нет - создаем профиль позже при первой необходимости
            return null;
        }
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error && error.code === 'PGRST116') {
            // Профиль не найден - создаем
            console.log('📝 Создаем профиль для пользователя');
            return await createDefaultProfile(userId);
        }
        
        if (error) throw error;
        
        if (profile) {
            storage.setItem('user_profile', JSON.stringify(profile));
            console.log('📋 Профиль загружен');
            return profile;
        }
    } catch (error) {
        console.warn('⚠️ Не удалось загрузить профиль:', error.message);
    }
    return null;
}

// Получение текущего пользователя
function getCurrentUser() {
    const userData = storage.getItem('user_profile');
    return userData ? JSON.parse(userData) : null;
}

// Проверка роли пользователя
function checkUserRole(requiredRole) {
    const user = getCurrentUser();
    if (!user) return false;
    
    if (Array.isArray(requiredRole)) {
        return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole;
}

// Получение ID текущего пользователя
function getCurrentUserId() {
    return storage.getItem('user_id');
}

// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ЗАКАЗАМИ
// ============================================

// Создание заказа
async function createOrder(orderData) {
    try {
        const userId = getCurrentUserId();
        if (!userId) {
            throw new Error('Пользователь не авторизован');
        }
        
        // Получаем email пользователя
        const userEmail = storage.getItem('user_email');
        
        const completeOrderData = {
            ...orderData,
            client_id: userId,
            client_email: userEmail || '',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        console.log('📦 Создание заказа:', completeOrderData);
        
        const { data, error } = await supabase
            .from('orders')
            .insert([completeOrderData])
            .select()
            .single();
            
        if (error) {
            console.error('❌ Ошибка создания заказа:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }
        
        console.log('✅ Заказ создан:', data.id);
        return data;
        
    } catch (error) {
        console.error('❌ Ошибка создания заказа:', error);
        throw error;
    }
}

// Получение заказов пользователя
async function getUserOrders() {
    try {
        const userId = getCurrentUserId();
        if (!userId) return [];
        
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('client_id', userId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Ошибка получения заказов:', error);
        return [];
    }
}

// ============================================
// ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ИНТЕРФЕЙСА
// ============================================

// Обновление UI в зависимости от авторизации
function updateAuthUI(isLoggedIn, user = null) {
    const loggedOutElements = document.querySelectorAll('.logged-out, [data-auth="logged-out"]');
    const loggedInElements = document.querySelectorAll('.logged-in, [data-auth="logged-in"]');
    const userEmailElements = document.querySelectorAll('.user-email, [data-user-email]');
    const userNameElements = document.querySelectorAll('.user-name, [data-user-name]');
    
    if (isLoggedIn) {
        loggedOutElements.forEach(el => el.style.display = 'none');
        loggedInElements.forEach(el => {
            el.style.display = '';
            el.style.alignItems = 'center';
        });
        
        if (user) {
            userEmailElements.forEach(el => {
                el.textContent = user.email;
                el.title = user.email;
            });
            
            const profile = getCurrentUser();
            const userName = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
            
            userNameElements.forEach(el => {
                el.textContent = userName;
                el.title = userName;
            });
        }
        
    } else {
        loggedOutElements.forEach(el => el.style.display = '');
        loggedInElements.forEach(el => el.style.display = 'none');
    }
}

// Перенаправление после авторизации
function handleAuthRedirect(user) {
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('/auth/')) {
        const role = user.user_metadata?.role || 'client';
        const dashboardPaths = {
            'client': 'pages/client/dashboard.html',
            'driver': 'pages/driver/dashboard.html',
            'fleet': 'pages/fleet/dashboard.html',
            'fleet_admin': 'pages/fleet/dashboard.html',
            'fleet_dispatcher': 'pages/fleet/dashboard.html',
            'system_admin': 'pages/admin/dashboard.html',
            'system_moderator': 'pages/admin/dashboard.html',
            'system_support': 'pages/admin/dashboard.html'
        };
        
        const redirectPath = dashboardPaths[role] || 'pages/client/dashboard.html';
        
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

// Проверка подключения к Supabase
async function checkSupabaseConnection() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        console.log('✅ Подключение к Supabase: УСПЕХ');
        return true;
    } catch (error) {
        console.error('❌ Ошибка подключения:', error.message);
        return false;
    }
}

// Выход из системы
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        storage.clear();
        updateAuthUI(false);
        
        // Не использовать уведомления
        // Notification.requestPermission(); // НЕ ИСПОЛЬЗОВАТЬ!
        
        window.location.href = '/';
        console.log('✅ Успешный выход');
    } catch (error) {
        console.error('❌ Ошибка выхода:', error.message);
        alert('Ошибка выхода: ' + error.message);
    }
}

// Проверка доступности страницы по роли
function checkPageAccess(requiredRoles) {
    const user = getCurrentUser();
    
    if (!user) {
        // Не авторизован
        if (!window.location.pathname.includes('/auth/')) {
            window.location.href = 'pages/auth/login.html';
        }
        return false;
    }
    
    if (Array.isArray(requiredRoles)) {
        if (!requiredRoles.includes(user.role)) {
            alert('У вас нет доступа к этой странице');
            window.location.href = 'pages/client/dashboard.html';
            return false;
        }
    } else if (user.role !== requiredRoles) {
        alert('У вас нет доступа к этой странице');
        window.location.href = 'pages/client/dashboard.html';
        return false;
    }
    
    return true;
}

// ============================================
// ЭКСПОРТ ФУНКЦИЙ
// ============================================

window.supabaseClient = supabase;
window.updateAuthUI = updateAuthUI;
window.getCurrentUser = getCurrentUser;
window.getCurrentUserId = getCurrentUserId;
window.checkUserRole = checkUserRole;
window.checkPageAccess = checkPageAccess;
window.logout = logout;
window.createOrder = createOrder;
window.getUserOrders = getUserOrders;

// ============================================
// АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚜 Tech Orders Platform: Загрузка...');
    
    // Отключаем автоматические запросы уведомлений
    if ('Notification' in window) {
        // Не запрашиваем разрешение автоматически
        console.log('🔕 Уведомления: автоматический запрос отключен');
    }
    
    const isConnected = await checkSupabaseConnection();
    
    if (isConnected) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            console.log('✅ Активная сессия обнаружена');
        } else {
            console.log('ℹ️ Активная сессия не обнаружена');
            updateAuthUI(false);
        }
    } else {
        console.error('❌ Нет подключения к Supabase');
        if (document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'background: #ff4444; color: white; padding: 10px; text-align: center; font-size: 14px;';
            errorDiv.innerHTML = '⚠️ Ошибка подключения к базе данных. <a href="javascript:location.reload()" style="color: white; text-decoration: underline;">Обновить страницу</a>';
            document.body.prepend(errorDiv);
        }
    }
    
    console.log('✅ Конфигурация загружена');
});

// ============================================
// ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ
// ============================================

window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Необработанная ошибка:', event.reason);
    
    // Автоматическое восстановление сессии при ошибках аутентификации
    if (event.reason?.message?.includes('auth') || event.reason?.message?.includes('session')) {
        console.log('🔄 Попытка восстановить сессию...');
        supabase.auth.refreshSession();
    }
});

window.addEventListener('error', (event) => {
    console.error('❌ Глобальная ошибка:', event.error);
});

// Блокировка запросов уведомлений
const originalRequestPermission = Notification.requestPermission;
Notification.requestPermission = function() {
    console.log('🔕 Запрос уведомлений заблокирован');
    return Promise.resolve('denied');
};

console.log('🎯 Supabase конфигурация инициализирована');
console.log('🔑 Проект:', SUPABASE_URL);
