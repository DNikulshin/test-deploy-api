import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({ description: 'The ID of the product to add', format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'The quantity of the product to add',
    example: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}
