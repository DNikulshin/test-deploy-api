import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PASSWORD_CHANGE_ALLOWED_KEY } from '../allow-password-change.decorator';

@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    const allowPasswordChange = this.reflector.get<boolean>(
      IS_PASSWORD_CHANGE_ALLOWED_KEY,
      context.getHandler(),
    );

    if (allowPasswordChange) {
      return true;
    }

    if (user && user.passwordChangeRequired) {
      throw new ForbiddenException('Password change required');
    }

    return true;
  }
}
