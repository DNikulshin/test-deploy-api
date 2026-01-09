import { ApiProperty } from '@nestjs/swagger';
import { CartItemDto } from './cart-item.dto';

export class CartDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: [CartItemDto] })
  items: CartItemDto[];

  @ApiProperty()
  total: number;
}
