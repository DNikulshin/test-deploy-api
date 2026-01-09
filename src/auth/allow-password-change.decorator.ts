import { SetMetadata } from '@nestjs/common';

export const IS_PASSWORD_CHANGE_ALLOWED_KEY = 'allowPasswordChange';
export const AllowPasswordChange = () =>
  SetMetadata(IS_PASSWORD_CHANGE_ALLOWED_KEY, true);
