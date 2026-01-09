import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService<Config>,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          // Passport автоматически вернет 401, если здесь будет null
          return request?.cookies?.refresh_token;
        },
      ]),
      secretOrKey: configService.get('jwtRefreshSecret')!,
      passReqToCallback: true,
    });
  }

  // Этот метод вызывается, только если подпись JWT валидна
  async validate(req: Request, payload: any) {
    const refreshTokenFromCookie = req.cookies.refresh_token;
    if (!refreshTokenFromCookie || !payload.sub) {
      throw new UnauthorizedException();
    }

    const userId = payload.sub;
    const userTokens = await this.prisma.refreshToken.findMany({
      where: { userId: userId },
    });

    if (!userTokens.length) {
      // У пользователя нет токенов в БД
      throw new UnauthorizedException();
    }

    let isValid = false;
    for (const tokenRecord of userTokens) {
      // Сравниваем токен из cookie с хешем из БД
      const isMatch = await bcrypt.compare(
        refreshTokenFromCookie,
        tokenRecord.tokenHash,
      );

      // Токен должен совпасть И не должен быть просрочен
      if (isMatch && tokenRecord.expiresAt >= new Date()) {
        isValid = true;
        break; // Нашли валидный, совпадающий токен, выходим из цикла
      }
    }

    if (!isValid) {
      // Если не нашли ни одного валидного токена
      throw new UnauthorizedException(
        'Refresh token is invalid, expired, or has been revoked.',
      );
    }

    // Если валидация прошла, Passport прикрепит этот объект к req.user
    return { ...payload, refreshToken: refreshTokenFromCookie };
  }
}
