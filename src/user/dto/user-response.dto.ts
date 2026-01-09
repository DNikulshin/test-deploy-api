import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

@Exclude()
export class UserResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор пользователя',
    example: 'clx... ',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Email пользователя',
    example: 'test@example.com',
  })
  @Expose()
  email: string;

  @ApiProperty({ description: 'Имя пользователя', example: 'John Doe' })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Роль пользователя',
    enum: Role,
    example: Role.USER,
  })
  @Expose()
  role: Role;

  // Все остальные поля, такие как passwordHash, refreshToken и т.д.,
  // будут автоматически исключены благодаря декоратору @Exclude() на уровне класса.
}
