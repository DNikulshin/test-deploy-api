import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Config } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(
  Strategy,
  'access-token',
) {
  constructor(
    configService: ConfigService<Config>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('jwtAccessSecret')!,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    jti: string;
    iat: number;
  }) {
    const isBlacklisted = await this.prisma.blacklistedToken.findUnique({
      where: { jti: payload.jti },
    });

    if (isBlacklisted) {
      throw new UnauthorizedException('Token is blacklisted');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (
      user.tokensValidFrom &&
      payload.iat * 1000 < user.tokensValidFrom.getTime()
    ) {
      throw new UnauthorizedException(
        'Token has been invalidated by a global logout',
      );
    }

    return user;
  }
}
