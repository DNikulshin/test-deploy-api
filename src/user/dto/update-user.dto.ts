import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// UpdateUserDto inherits validation rules from CreateUserDto (email, name, password)
// but makes them all optional.
export class UpdateUserDto extends PartialType(CreateUserDto) {}
