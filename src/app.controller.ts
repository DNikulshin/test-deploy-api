import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import * as os from 'os';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Новый эндпоинт для проверки балансировки
  @Get('whoami')
  whoAmI() {
    // os.hostname() вернет уникальное имя хоста контейнера
    return `Request was handled by container: ${os.hostname()}`;
  }
}
