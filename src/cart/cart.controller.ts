import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Put,
  Delete,
  ParseUUIDPipe,
  Req,
  HttpCode,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CartDto } from './dto/cart.dto';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import {
  ApiTags,
  ApiOkResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOkResponse({ description: 'Retrieve user cart', type: CartDto })
  async getCart(@Req() req: any): Promise<CartDto> {
    return this.cartService.getCart(req.user.id);
  }

  @Post('items')
  @HttpCode(200) // Устанавливаем код ответа 200 OK
  @ApiOkResponse({
    description: 'Add item to cart or update quantity',
    type: CartDto,
  })
  async addToCart(
    @Req() req: any,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<CartDto> {
    return this.cartService.addToCart(req.user.id, addToCartDto);
  }

  @Put('items/:productId')
  @ApiOkResponse({ description: 'Update cart item quantity', type: CartDto })
  @ApiNotFoundResponse({ description: 'Product not found in cart' })
  async updateCartItem(
    @Req() req: any,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartDto> {
    return this.cartService.updateCartItem(
      req.user.id,
      productId,
      updateCartItemDto,
    );
  }

  @Delete('items/:productId')
  @ApiOkResponse({ description: 'Remove item from cart', type: CartDto })
  @ApiNotFoundResponse({ description: 'Product not found in cart' })
  async removeCartItem(
    @Req() req: any,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<CartDto> {
    return this.cartService.removeCartItem(req.user.id, productId);
  }

  @Delete()
  @ApiOkResponse({ description: 'Clear user cart', type: CartDto })
  async clearCart(@Req() req: any): Promise<CartDto> {
    return this.cartService.clearCart(req.user.id);
  }
}
