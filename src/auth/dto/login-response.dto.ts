import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../user/dto/user-response.dto';
import { Expose, Type } from 'class-transformer';

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT Access Token', example: 'eyJhbGci... ' })
  @Expose()
  accessToken: string;

  @ApiProperty({ type: () => UserResponseDto })
  @Expose()
  @Type(() => UserResponseDto)
  user: UserResponseDto;
}
