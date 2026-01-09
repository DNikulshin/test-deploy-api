const PORT = 3000;
const DOCKER_SERVICE_NAME = 'main-db';

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
      // Не считаем ошибкой, если процесс был убит внешним сигналом
      if (error.isTerminated) return { ...error, success: true, killed: true };
      
      logError(`Ошибка при выполнении: ${command} ${args.join(' ')}`);
      return { ...error, success: false };
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
    log('Проверка и запуск Docker-контейнера базы данных...');

    const { stdout: psOutput } = await execa('docker-compose', ['ps', '-q', DOCKER_SERVICE_NAME]);

    if (!psOutput) {
      log(`Контейнер '${DOCKER_SERVICE_NAME}' не запущен. Запускаем...`);
      const upResult = await runCommand('docker-compose', ['up', '-d', DOCKER_SERVICE_NAME]);
      if (!upResult.success) return false;
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      log(`Контейнер '${DOCKER_SERVICE_NAME}' уже запущен.`);
    }

    log('Ожидание доступности Postgres...');
    for (let i = 0; i < 30; i++) {
      try {
        await execa('docker-compose', ['exec', '-T', DOCKER_SERVICE_NAME, 'pg_isready', '-U', 'postgres', '-q'], { stdio: 'ignore' });
        log('База данных готова.');
        return true;
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logError('База данных не стала доступной после 60 секунд ожидания.');
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
    
    // execa по умолчанию корректно обрабатывает завершение дочернего процесса
    await execa('npm', ['run', 'start', '--', '--watch'], { stdio: 'inherit' });

  } catch (error) {
    // Логируем ошибку только если процесс не был штатно завершен (например, по Ctrl+C)
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
