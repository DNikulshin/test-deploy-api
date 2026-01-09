import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class CreateAdminUserDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Admin user email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin User', description: 'Admin user name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'password', description: 'Admin user password' })
  @IsString()
  password: string;
}
