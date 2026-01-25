const PORT = 3000;
const DOCKER_SERVICE_NAME = 'main-db';
const DOCKER_COMPOSE_FILE = 'docker-compose.dev.yml';

// --- Утилиты для логирования ---
const log = (message) => console.log(`[run-dev] ${message}`);
const logError = (message) => console.error(`[run-dev] ERROR: ${message}`);
const logSeparator = () => console.log('---');

// --- Основная функция ---
async function main() {
  const { execa } = await import('execa');
  const killPort = (await import('kill-port')).default;

  // --- Функция для выполнения команд с логированием ---
  const runCommand = async (command, args = [], options = {}) => {
    log(`Выполнение: ${command} ${args.join(' ')}`);
    try {
      const result = await execa(command, args, { stdio: 'inherit', ...options });
      return { ...result, success: true };
    } catch (error) {
      if (error.isTerminated) return { ...result, success: true, killed: true };
      logError(`Ошибка при выполнении: ${command} ${args.join(' ')}`);
      return { ...error, success: false };
    }
  };
  
    // --- Функция для вывода логов Docker при ошибке ---
  const showDockerLogsOnError = async (serviceName, composeArgs) => {
    logError(`Попытка получить логи для сервиса '${serviceName}'...`);
    try {
      const { stdout, stderr } = await execa('docker-compose', [...composeArgs, 'logs', '--tail=100', serviceName]);
      logSeparator();
      logError(`ЛОГИ DOCKER-КОНТЕЙНЕРА ('${serviceName}'):`);
      console.error(stdout);
      if (stderr) console.error(stderr);
      logSeparator();
    } catch (logError) {
      logError(`Не удалось получить логи для сервиса '${serviceName}': ${logError.message}`);
    }
  };


  // --- 1. Освобождение порта ---
  async function freePort() {
    logSeparator();
    log(`Проверка и освобождение порта ${PORT}...`);
    try {
      await killPort(PORT);
      log(`Порт ${PORT} успешно освобожден.`);
      return true;
    } catch (error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('could not find a process') || errorMessage.includes('no process running on port')) {
        log(`Порт ${PORT} уже свободен.`);
        return true;
      }
      logError(`Не удалось освободить порт ${PORT}.`);
      logError(error.message);
      return false;
    }
  }

  // --- 2. Ожидание готовности базы данных ---
  async function ensureDbReady() {
    logSeparator();
    log('Полная очистка Docker-окружения для чистого запуска...');
    const dockerComposeArgs = ['-f', DOCKER_COMPOSE_FILE];
    
    // 1. Всегда останавливаем и удаляем старые контейнеры/тома
    await runCommand('docker-compose', [...dockerComposeArgs, 'down', '-v']);
    
    logSeparator();
    log('Запуск Docker-контейнера базы данных...');
    
    // 2. Запускаем новый контейнер
    const upResult = await runCommand('docker-compose', [...dockerComposeArgs, 'up', '-d', DOCKER_SERVICE_NAME]);
    if (!upResult.success) {
        logError('Не удалось выполнить docker-compose up.');
        return false;
    }
    
    // Даем немного времени на первоначальный запуск
    await new Promise(resolve => setTimeout(resolve, 5000));

    log('Ожидание доступности Postgres...');
    for (let i = 0; i < 30; i++) {
        log(`Попытка подключения к БД (попытка ${i + 1}/30)...`);
      try {
        await execa('docker-compose', [...dockerComposeArgs, 'exec', '-T', DOCKER_SERVICE_NAME, 'pg_isready', '-U', 'postgres', '-q'], { stdio: 'ignore' });
        log('База данных готова.');
        return true;
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logError('База данных не стала доступной после 60 секунд ожидания.');
    await showDockerLogsOnError(DOCKER_SERVICE_NAME, dockerComposeArgs);
    return false;
  }

  try {
    if (!(await freePort())) process.exit(1);
    if (!(await ensureDbReady())) process.exit(1);

    logSeparator();
    log('Применение миграций базы данных...');
    if (!(await runCommand('npm', ['run', 'prisma:dev:migrate'])).success) process.exit(1);

    logSeparator();
    log('Наполнение базы данных начальными данными...');
    if (!(await runCommand('npm', ['run', 'prisma:seed'])).success) process.exit(1);

    logSeparator();
    log('Запуск NestJS приложения в режиме разработки...');
    
    await execa('npm', ['run', 'start', '--', '--watch'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } });

  } catch (error) {
    if (error.isTerminated) {
      log('Сервер разработки остановлен.');
    } else {
      logError('Критическая ошибка в скрипте run-dev.');
      logError(error);
      process.exit(1);
    }
  }
}

main().catch(err => {
    logError('Критическая ошибка при запуске main.');
    logError(err);
    process.exit(1);
});
