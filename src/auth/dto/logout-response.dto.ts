import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({
    example: 'Logged out successfully',
    description: 'Logout confirmation message',
  })
  message: string;

  constructor(partial: Partial<LogoutResponseDto>) {
    Object.assign(this, partial);
  }
}
