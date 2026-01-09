import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  IsOptional,
  IsUrl,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Cool T-Shirt' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Detailed product description',
    example: 'A very cool t-shirt made from 100% cotton.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Price of the product', example: 29.99 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'URL of the product image',
    example: 'https://example.com/image.png',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ description: 'Available stock quantity', example: 100 })
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiProperty({
    description: 'ID of the category this product belongs to',
    example: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6',
  })
  @IsUUID()
  categoryId: string;
}
