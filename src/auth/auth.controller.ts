import {
  Body,
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Delete,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import type { Response, Request } from 'express';
import { AllowPasswordChange } from './allow-password-change.decorator';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { Type } from 'class-transformer';
import { LoginResponseDto } from './dto/login-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (Public)' })
  @ApiCreatedResponse({
    description: 'User registered successfully',
    type: LoginResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  @Type(() => LoginResponseDto)
  register(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.register(createUserDto, response);
  }

  @Post('login')
  @AllowPasswordChange()
  @ApiOperation({ summary: 'Login a user' })
  @ApiOkResponse({
    description: 'User logged in successfully',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiCookieAuth()
  @HttpCode(HttpStatus.OK)
  login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(loginUserDto, response);
  }

  @ApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiCreatedResponse({
    description: 'Token refreshed successfully',
    type: LoginResponseDto,
  })
  @ApiCookieAuth()
  @HttpCode(HttpStatus.OK)
  refresh(@Req() req: any, @Res({ passthrough: true }) response: Response) {
    const userId = req.user.sub;
    const refreshToken = req.cookies.refresh_token;
    return this.authService.refreshToken(userId, refreshToken, response);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @AllowPasswordChange()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout a user from current session' })
  @ApiOkResponse({
    description: 'User logged out successfully',
    type: MessageResponseDto,
  })
  @ApiCookieAuth()
  logout(@Req() req: any, @Res({ passthrough: true }) response: Response) {
    const refreshToken = req.cookies.refresh_token;
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('Access token not found');
    const accessToken = authHeader.split(' ')[1];

    return this.authService.logout(
      req.user.id,
      refreshToken,
      accessToken,
      response,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Delete('logout/all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout a user from all sessions' })
  @ApiOkResponse({
    description: 'User logged out from all sessions successfully',
    type: MessageResponseDto,
  })
  async logoutAllSessions(@Req() req: any) {
    return this.authService.logoutAllSessions(req.user.id);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate password reset process' })
  @ApiOkResponse({
    description:
      'If a user with that email exists, a password reset link will be sent.',
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<void> {
    await this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset a user password with a valid token' })
  @ApiNoContentResponse({
    description: 'Password has been reset successfully.',
  })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
