
console.log('==================================================');
console.log('RUNNING UNIFIED test-qa.js SCRIPT');
console.log('Setup, full test suite, and teardown are in this file.');
console.log('==================================================');

const DOCKER_SERVICE_NAME = 'main-db';
// Изменено: Убран префикс /api и используется существующий публичный эндпоинт
const HEALTH_CHECK_URL = 'http://localhost:3000/category'; 
const MAX_HEALTH_RETRIES = 30;

// --- Утилиты для логирования ---
const log = (message) => console.log(`[test-qa] ${message}`);
const logError = (message) => console.error(`[test-qa] ERROR: ${message}`);
const logSeparator = () => console.log('---');
const testStepHeader = (message) => console.log(`\n\x1b[33m--- ${message} ---\x1b[0m`);
const testLog = (message) => console.log(`- ${message}...`);
const testSuccess = (message) => console.log('\x1b[32mУСПЕХ\x1b[0m', message ? `- ${message}`: '');
const testError = (message) => console.error('\x1b[31m%s\x1b[0m', message);

// --- Основная функция ---
async function main() {
  const { execa } = await import('execa');
  const axios = (await import('axios')).default;
  const { CookieJar } = await import('tough-cookie');
  const { wrapper } = await import('axios-cookiejar-support');

  // Создаем HTTP-клиенты для разных ролей и устройств
  const userClient = wrapper(axios.create({ jar: new CookieJar() })); // Основной клиент пользователя
  const adminClient = wrapper(axios.create({ jar: new CookieJar() })); // Клиент администратора
  const secondDeviceClient = wrapper(axios.create({ jar: new CookieJar() })); // Клиент для второго устройства
  
  let serverProcess;

  const runCommand = async (command, args, options = {}) => {
    log(`Выполнение: ${command} ${args.join(' ')}`);
    try {
      const result = await execa(command, args, { stdio: 'inherit', ...options });
      return { ...result, success: true };
    } catch (error) {
      logError(`Ошибка при выполнении: ${command} ${args.join(' ')}`);
      return { ...error, success: false };
    }
  };
  
  const runDbCheckCommand = async (command, args) => {
    try {
      await execa(command, args, { stdio: 'ignore' });
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  };

  const cleanup = () => {
    if (serverProcess && !serverProcess.killed) {
      log('Остановка фонового процесса сервера...');
      serverProcess.kill();
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    // 1. Окружение
    logSeparator();
    log('Остановка и удаление Docker-контейнеров...');
    await runCommand('docker-compose', ['down', '-v']);

    logSeparator();
    log('Запуск контейнера базы данных...');
    if (!(await runCommand('docker-compose', ['up', '-d', DOCKER_SERVICE_NAME])).success) {
      throw new Error('Не удалось запустить БД.');
    }

    logSeparator();
    log('Ожидание готовности Postgres...');
    let dbReady = false;
    for (let i = 0; i < 30; i++) {
      if ((await runDbCheckCommand('docker-compose', ['exec', '-T', DOCKER_SERVICE_NAME, 'pg_isready', '-U', 'postgres', '-q'])).success) {
        dbReady = true;
        break;
      }
      await new Promise(res => setTimeout(res, 2000));
    }
    if (!dbReady) throw new Error('База данных не стала доступной.');
    log('База данных готова.');

    logSeparator();
    log('Сброс и применение миграций...');
    if (!(await runCommand('npx', ['prisma', 'migrate', 'reset', '--force'])).success) {
      throw new Error('Не удалось сбросить миграции Prisma.');
    }

    logSeparator();
    log('Сборка проекта (build step)...');
    if (!(await runCommand('npm', ['run', 'build'])).success) {
      throw new Error('Не удалось собрать проект.');
    }

    logSeparator();
    log('Запуск NestJS сервера в фоновом режиме...');
    serverProcess = execa('npm', ['run', 'start:prod'], { stdio: 'inherit' });
    serverProcess.catch(err => {
      if (!err.isKilled) logError('Процесс сервера завершился с ошибкой.');
    });

    logSeparator();
    log(`Ожидание доступности API по адресу ${HEALTH_CHECK_URL}...`);
    let apiReady = false;
    for (let i = 0; i < MAX_HEALTH_RETRIES; i++) {
        try {
            await axios.get(HEALTH_CHECK_URL, { timeout: 1000 });
            apiReady = true;
            break;
        } catch (e) {
            await new Promise(res => setTimeout(res, 2000));
        }
    }
    if (!apiReady) throw new Error('API не стало доступным.');
    log('API доступно.');

    // 2. ЗАПУСК QA-ТЕСТОВ
    logSeparator();
    log('Запуск полного QA-тестирования...');
    await runFullQATests(userClient, adminClient, secondDeviceClient);

    // 3. Успешное завершение
    testSuccess('\nВсе тесты успешно пройдены!');
    process.exit(0);

  } catch (error) {
    testError(`\nТЕСТИРОВАНИЕ ПРЕРВАНО ИЗ-ЗА ОШИБКИ: ${error.message}`);
    process.exit(1);
  }
}


// =========================================================================
// ========================= ПОЛНЫЙ НАБОР ТЕСТОВ ===========================
// =========================================================================
async function runFullQATests(userClient, adminClient, secondDeviceClient) {
    const uniqueId = Date.now();
    const userPayload = {
      email: `qa-user-${uniqueId}@test.com`,
      password: 'password123',
      name: 'QA User',
    };
    let accessToken, adminAccessToken, productToTest, newProductByAdmin, newOrderByUser, userToDelete, newCategoryByAdmin;

    const testRequest = async (description, { client, method, path, data, expectedStatus, headers = {} }) => {
        testLog(description);
        try {
            // Изменено: Убран префикс /api
            const response = await client({
                method,
                url: `http://localhost:3000${path}`,
                data,
                headers,
                validateStatus: (status) => status === expectedStatus,
            });
            testSuccess();
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            const responseData = error.response?.data;
            const errorMsg = `НЕУДАЧА (Ожидался код ${expectedStatus}, получен ${status || 'N/A'})\n  Детали: ${JSON.stringify(responseData)}`;
            testError(errorMsg);
            throw new Error(description);
        }
    };
    
    // --- ЧАСТЬ 1: РЕГИСТРАЦИЯ И ВХОД ---
    testStepHeader('ЧАСТЬ 1: РЕГИСТРАЦИЯ И ВХОД');
    await testRequest('Регистрация нового пользователя', {
        client: userClient, method: 'POST', path: '/auth/register', data: userPayload, expectedStatus: 201
    });
    const loginResponse = await testRequest('Вход пользователя в систему', {
        client: userClient, method: 'POST', path: '/auth/login', data: userPayload, expectedStatus: 200
    });
    accessToken = loginResponse.accessToken;

    // --- ЧАСТЬ 2: АДМИН ---
    testStepHeader('ЧАСТЬ 2: ВХОД АДМИНИСТРАТОРА И СМЕНА ПАРОЛЯ');
    // Изменено: email администратора
    const adminLoginInitial = await testRequest('Первичный вход администратора', {
        client: adminClient, method: 'POST', path: '/auth/login', data: { email: 'admin@admin.ru', password: 'admin123' }, expectedStatus: 200
    });
    // Изменено: currentPassword администратора
    await testRequest('Смена пароля администратора', {
        client: adminClient, method: 'PATCH', path: '/users/me/password', headers: { Authorization: `Bearer ${adminLoginInitial.accessToken}` },
        data: { currentPassword: 'admin123', newPassword: 'newPassword123', newPasswordConfirmation: 'newPassword123' }, expectedStatus: 200
    });
    // Изменено: email администратора
    const adminLoginFinal = await testRequest('Вход администратора с новым паролем', {
        client: adminClient, method: 'POST', path: '/auth/login', data: { email: 'admin@admin.ru', password: 'newPassword123' }, expectedStatus: 200
    });
    adminAccessToken = adminLoginFinal.accessToken;

    // --- ЧАСТЬ 3: УПРАВЛЕНИЕ КАТЕГОРИЯМИ (АДМИН) ---
    testStepHeader('ЧАСТЬ 3: УПРАВЛЕНИЕ КАТЕГОРИЯМИ (АДМИН)');
    newCategoryByAdmin = await testRequest('Создание категории', {
        client: adminClient, method: 'POST', path: '/category', headers: { Authorization: `Bearer ${adminAccessToken}` },
        data: { name: 'Test Category' }, expectedStatus: 201
    });
    await testRequest('Получение всех категорий', {
        client: userClient, method: 'GET', path: '/category', expectedStatus: 200
    });
    await testRequest('Получение категории по ID', {
        client: userClient, method: 'GET', path: `/category/${newCategoryByAdmin.id}`, expectedStatus: 200
    });
    await testRequest('Обновление категории', {
        client: adminClient, method: 'PATCH', path: `/category/${newCategoryByAdmin.id}`,
        headers: { Authorization: `Bearer ${adminAccessToken}` }, data: { name: 'Updated Test Category' }, expectedStatus: 200
    });

    // --- ЧАСТЬ 4: УПРАВЛЕНИЕ ПРОДУКТАМИ (АДМИН) ---
    testStepHeader('ЧАСТЬ 4: УПРАВЛЕНИЕ ПРОДУКТАМИ (АДМИН)');
    newProductByAdmin = await testRequest('Создание продукта', {
        client: adminClient, method: 'POST', path: '/products', headers: { Authorization: `Bearer ${adminAccessToken}` },
        data: { name: 'Admin Product', description: 'desc', price: 100, imageUrl: 'http://example.com/image.png', stock: 10, categoryId: newCategoryByAdmin.id }, expectedStatus: 201
    });
    await testRequest('Обновление продукта', {
        client: adminClient, method: 'PATCH', path: `/products/${newProductByAdmin.id}`,
        headers: { Authorization: `Bearer ${adminAccessToken}` }, data: { price: 150 }, expectedStatus: 200
    });

    // --- ЧАСТЬ 5: ПРОДУКТЫ И КОРЗИНА (ПОЛЬЗОВАТЕЛЬ) ---
    testStepHeader('ЧАСТЬ 5: ПРОДУКТЫ И КОРЗИНА (ПОЛЬЗОВАТЕЛЬ)');
    const productsFiltered = await testRequest('Получение списка продуктов (с фильтром по категории)', { client: userClient, method: 'GET', path: `/products?categoryId=${newCategoryByAdmin.id}`, expectedStatus: 200 });
    if (productsFiltered.length !== 1 || productsFiltered[0].id !== newProductByAdmin.id) {
        throw new Error('Фильтрация продуктов по категории не работает.');
    }
    const products = await testRequest('Получение списка продуктов', { client: userClient, method: 'GET', path: '/products', expectedStatus: 200 });
    productToTest = products.find(p => p.id === newProductByAdmin.id);
    await testRequest('Получение одного продукта по ID', { client: userClient, method: 'GET', path: `/products/${productToTest.id}`, expectedStatus: 200 });
    await testRequest('Добавление продукта в корзину', {
        client: userClient, method: 'POST', path: '/cart/items', headers: { Authorization: `Bearer ${accessToken}` },
        data: { productId: productToTest.id, quantity: 1 }, expectedStatus: 200
    });
    await testRequest('Обновление кол-ва товара в корзине', {
        client: userClient, method: 'PUT', path: `/cart/items/${productToTest.id}`, headers: { Authorization: `Bearer ${accessToken}` },
        data: { quantity: 3 }, expectedStatus: 200
    });
    await testRequest('Удаление товара из корзины', {
        client: userClient, method: 'DELETE', path: `/cart/items/${productToTest.id}`, headers: { Authorization: `Bearer ${accessToken}` }, expectedStatus: 200
    });
    await testRequest('Повторное добавление товара', { // Для создания заказа
        client: userClient, method: 'POST', path: '/cart/items', headers: { Authorization: `Bearer ${accessToken}` },
        data: { productId: productToTest.id, quantity: 2 }, expectedStatus: 200
    });
    
    // --- ЧАСТЬ 6: ЗАКАЗЫ (ПОЛЬЗОВАТЕЛЬ) ---
    testStepHeader('ЧАСТЬ 6: СОЗДАНИЕ И ПРОСМОТР ЗАКАЗА (ПОЛЬЗОВАТЕЛЬ)');
    const cartBeforeOrder = await testRequest('Получение корзины перед заказом', { client: userClient, method: 'GET', path: '/cart', headers: { Authorization: `Bearer ${accessToken}` }, expectedStatus: 200 });
    newOrderByUser = await testRequest('Создание заказа', {
        client: userClient, method: 'POST', path: '/orders', headers: { Authorization: `Bearer ${accessToken}` },
        data: { products: cartBeforeOrder.items.map(item => ({ productId: item.product.id, quantity: item.quantity })) }, expectedStatus: 201
    });
    const cartAfterOrder = await testRequest('Проверка, что корзина пуста', { client: userClient, method: 'GET', path: '/cart', headers: { Authorization: `Bearer ${accessToken}` }, expectedStatus: 200 });
    if (cartAfterOrder.items.length !== 0) throw new Error('Корзина не была очищена после заказа.');
    await testRequest('Получение списка своих заказов', { client: userClient, method: 'GET', path: '/orders', headers: { Authorization: `Bearer ${accessToken}` }, expectedStatus: 200 });

    // --- ЧАСТЬ 7: УПРАВЛЕНИЕ ЗАКАЗАМИ (АДМИН) ---
    testStepHeader('ЧАСТЬ 7: УПРАВЛЕНИЕ ЗАКАЗАМИ (АДМИН)');
    await testRequest('Получение всех заказов', { client: adminClient, method: 'GET', path: '/orders/admin', headers: { Authorization: `Bearer ${adminAccessToken}` }, expectedStatus: 200 });
    await testRequest('Получение заказа по ID', { client: adminClient, method: 'GET', path: `/orders/${newOrderByUser.id}`, headers: { Authorization: `Bearer ${adminAccessToken}` }, expectedStatus: 200 });
    await testRequest('Обновление статуса заказа', {
        client: adminClient, method: 'PATCH', path: `/orders/${newOrderByUser.id}`, headers: { Authorization: `Bearer ${adminAccessToken}` },
        data: { status: 'SHIPPED' }, expectedStatus: 200
    });
    await testRequest('Удаление заказа', {
        client: adminClient, method: 'DELETE', path: `/orders/${newOrderByUser.id}`, headers: { Authorization: `Bearer ${adminAccessToken}` }, expectedStatus: 200
    });

    // --- ЧАСТЬ 8: УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (АДМИН) ---
    testStepHeader('ЧАСТЬ 8: УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (АДМИН)');
    const userList = await testRequest('Получение списка всех пользователей', { client: adminClient, method: 'GET', path: '/users', headers: { Authorization: `Bearer ${adminAccessToken}` }, expectedStatus: 200 });
    userToDelete = userList.find(u => u.email === userPayload.email);
    await testRequest('Получение пользователя по ID', { client: adminClient, method: 'GET', path: `/users/${userToDelete.id}`, headers: { Authorization: `Bearer ${adminAccessToken}` }, expectedStatus: 200 });
    await testRequest('Обновление данных пользователя', {
        client: adminClient, method: 'PATCH', path: `/users/${userToDelete.id}`, headers: { Authorization: `Bearer ${adminAccessToken}` },
        data: { name: 'New QA Name' }, expectedStatus: 200
    });

    // --- ЧАСТЬ 9: ПРОДВИНУТАЯ АУТЕНТИФИКАЦИЯ И ПРОФИЛЬ ---
    testStepHeader('ЧАСТЬ 9: ПРОДВИНУТАЯ АУТЕНТИФИКАЦИЯ И ПРОФИЛЬ');
    await testRequest('Обновление своего профиля (имя)', {
        client: userClient, method: 'PATCH', path: '/users/me', headers: { Authorization: `Bearer ${accessToken}` },
        data: { name: 'My New Name' }, expectedStatus: 200
    });
    const refreshed = await testRequest('Обновление токена (refresh)', {
        client: userClient, method: 'POST', path: '/auth/refresh', headers: { Authorization: `Bearer ${accessToken}` }, expectedStatus: 200
    });
    accessToken = refreshed.accessToken; // Обновляем токен для будущих запросов
    await testRequest('Вход с другого устройства', {
        client: secondDeviceClient, method: 'POST', path: '/auth/login', data: userPayload, expectedStatus: 200
    });
    await testRequest('Выход со всех устройств', {
        client: userClient, method: 'DELETE', path: '/auth/logout/all', headers: { Authorization: `Bearer ${accessToken}` }, expectedStatus: 200
    });
    await testRequest('Проверка доступа (1-е устройство)', { client: userClient, method: 'GET', path: '/users/me', headers: { Authorization: `Bearer ${accessToken}` }, expectedStatus: 401 });
    await testRequest('Проверка доступа (2-е устройство)', { client: secondDeviceClient, method: 'GET', path: '/users/me', expectedStatus: 401 });
    await testRequest('Запрос на сброс пароля', {
        client: userClient, method: 'POST', path: '/auth/forgot-password', data: { email: userPayload.email }, expectedStatus: 200
    });
    // Эндпоинт /auth/reset-password не может быть полностью протестирован, т.к. требует токен из email.

    // --- ЧАСТЬ 10: ФИНАЛЬНАЯ ОЧИСТКА ---
    testStepHeader('ЧАСТЬ 10: ФИНАЛЬНАЯ ОЧИСТКА');
    await testRequest('Удаление продукта (админ)', { // Удаляем созданный продукт
        client: adminClient, method: 'DELETE', path: `/products/${newProductByAdmin.id}`,
        headers: { Authorization: `Bearer ${adminAccessToken}` }, expectedStatus: 200
    });
    await testRequest('Удаление категории (админ)', { // Удаляем созданную категорию
        client: adminClient, method: 'DELETE', path: `/category/${newCategoryByAdmin.id}`,
        headers: { Authorization: `Bearer ${adminAccessToken}` }, expectedStatus: 200
    });
    await testRequest('Удаление пользователя (админ)', { // Удаляем созданного пользователя
        client: adminClient, method: 'DELETE', path: `/users/${userToDelete.id}`,
        headers: { Authorization: `Bearer ${adminAccessToken}` }, expectedStatus: 200
    });
}

main();
