import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true; // No roles specified, access is granted
    }
    const { user } = context.switchToHttp().getRequest();
    // The user object might not exist if the request is not authenticated
    // or if the JWT strategy did not attach it.
    // In a real app, you would probably want to throw a ForbiddenException here.
    if (!user || !user.role) {
      return false;
    }
    return requiredRoles.some((role) => user.role === role);
  }
}
