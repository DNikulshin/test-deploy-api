import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ description: 'The new quantity of the product', example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}
