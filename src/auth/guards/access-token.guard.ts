import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PASSWORD_CHANGE_ALLOWED_KEY } from '../allow-password-change.decorator';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AccessTokenGuard extends AuthGuard('access-token') {
  // Changed 'jwt' to 'access-token'
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // This will now correctly use the 'access-token' strategy
      const canActivate = await super.canActivate(context);
      if (typeof canActivate === 'boolean') {
        if (!canActivate) {
          return false;
        }
      } else if (
        typeof canActivate === 'object' &&
        canActivate !== null &&
        typeof canActivate.subscribe === 'function'
      ) {
        if (!(await lastValueFrom(canActivate))) {
          return false;
        }
      }
    } catch (err) {
      // super.canActivate may throw an error (e.g. UnauthorizedException) which we want to propagate
      throw err;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      // This case should theoretically be handled by super.canActivate, but as a safeguard:
      throw new UnauthorizedException();
    }

    const isPasswordChangeAllowed = this.reflector.getAllAndOverride<boolean>(
      IS_PASSWORD_CHANGE_ALLOWED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (user.passwordChangeRequired && !isPasswordChangeAllowed) {
      throw new ForbiddenException(
        'Password change required. Please update your password.',
      );
    }

    return true;
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
