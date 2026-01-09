import { ApiProperty } from '@nestjs/swagger';
import { ProductDto } from '../../product/dto/product.dto';

export class CartItemDto {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiProperty({ type: () => ProductDto })
  product: ProductDto;
}
