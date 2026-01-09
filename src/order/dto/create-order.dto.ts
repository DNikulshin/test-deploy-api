import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class ProductInOrderDto {
  @ApiProperty({ example: 'clq7z3j0w0000z7c9h4z0q9c9' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [ProductInOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductInOrderDto)
  products: ProductInOrderDto[];
}
