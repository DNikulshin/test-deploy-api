import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TokenCleanupMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TokenCleanupMiddleware.name);

  constructor(private readonly authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Очищаем истекшие токены перед критическими операциями аутентификации
    const authPaths = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
    ];

    if (authPaths.some((path) => req.path.includes(path))) {
      try {
        const deletedCount =
          await this.authService.removeExpiredRefreshTokens();
        if (deletedCount > 0) {
          this.logger.log(`Cleaned up ${deletedCount} expired refresh tokens`);
        }
      } catch (error) {
        // Не блокируем основной запрос, если очистка не удалась
        this.logger.error('Token cleanup failed:', error.message);
      }
    }

    next();
  }
}
