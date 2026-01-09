import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginUserDto } from './dto/login-user.dto';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../email/email.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  private async getTokens(userId: string, email: string, role: string) {
    const { v4: uuidv4 } = await import('uuid');
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role, jti: uuidv4() },
        {
          secret: this.configService.get<string>('jwtAccessSecret'),
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role, jti: uuidv4() },
        {
          secret: this.configService.get<string>('jwtRefreshSecret'),
          expiresIn: '7d',
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async hashToken(token: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(token, saltRounds);
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId: userId,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const hashedRefreshToken = await this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashedRefreshToken,
        userId: userId,
        expiresAt: expiresAt,
      },
    });
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string) {
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  async register(createUserDto: CreateUserDto, response: Response) {
    const newUser = await this.userService.create(createUserDto);
    if (!newUser) {
      throw new ConflictException('Could not create user');
    }

    await this.prisma.refreshToken.deleteMany({
      where: { userId: String(newUser.id) },
    });

    const tokens = await this.getTokens(
      String(newUser.id),
      newUser.email,
      newUser.role,
    );
    await this.saveRefreshToken(String(newUser.id), tokens.refreshToken);
    this.setRefreshTokenCookie(response, tokens.refreshToken);

    return { accessToken: tokens.accessToken, user: newUser };
  }

  async login(loginUserDto: LoginUserDto, response: Response) {
    const { email, password } = loginUserDto;
    const user = await this.userService.findByEmail(email, true);
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    await this.prisma.refreshToken.deleteMany({
      where: { userId: String(user.id) },
    });

    const tokens = await this.getTokens(String(user.id), user.email, user.role);
    await this.saveRefreshToken(String(user.id), tokens.refreshToken);
    this.setRefreshTokenCookie(response, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      user: this.userService.toUserDto(user),
    };
  }

  async logout(
    userId: string,
    refreshToken: string,
    accessToken: string,
    response: Response,
  ): Promise<{ message: string }> {
    if (userId && refreshToken) {
      const hashedToken = await this.hashToken(refreshToken);

      await this.prisma.refreshToken.deleteMany({
        where: {
          userId: userId,
          tokenHash: hashedToken,
        },
      });
    }

    if (accessToken) {
      const decodedToken = this.jwtService.decode(accessToken);
      if (decodedToken && decodedToken.jti) {
        await this.prisma.blacklistedToken.create({
          data: {
            jti: decodedToken.jti,
            expiresAt: new Date(decodedToken.exp * 1000),
          },
        });
      }
    }

    response.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  }

  async logoutAllSessions(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokensValidFrom: new Date() },
    });

    return { message: 'Logged out from all sessions successfully' };
  }

  async refreshToken(userId: string, rt: string, response: Response) {
    const user = await this.userService.findOne(userId, true);
    if (!user) throw new ForbiddenException('Access denied');

    const tokens = await this.getTokens(userId, user.email, user.role);

    await this.prisma.refreshToken.deleteMany({
      where: { userId: userId },
    });

    await this.saveRefreshToken(userId, tokens.refreshToken);
    this.setRefreshTokenCookie(response, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      user: this.userService.toUserDto(user),
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const { email } = forgotPasswordDto;
    const user = await this.userService.findByEmail(email, true);

    if (user) {
      const resetToken = this.jwtService.sign(
        { sub: user.id, email: user.email },
        {
          secret: this.configService.get<string>('jwtResetSecret'),
          expiresIn: '1h',
        },
      );

      await this.userService.setResetToken(
        String(user.id),
        resetToken,
        new Date(Date.now() + 3600000),
      );

      await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto;

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwtResetSecret'),
      });

      const user = await this.userService.findOne(payload.sub, true);

      if (!user || !user.resetToken || user.resetTokenExpires < new Date()) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await this.prisma.refreshToken.deleteMany({
        where: {
          userId: String(user.id),
        },
      });

      await this.userService.updatePassword(String(user.id), hashedPassword);
    } catch (error) {
      if (
        error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }
      throw error;
    }
  }

  async removeExpiredRefreshTokens(): Promise<number> {
    const expiredTokens = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return expiredTokens.count;
  }
}
