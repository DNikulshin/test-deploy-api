import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../auth/role.enum';

export class UserDto {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: Role })
  role: Role;
}
