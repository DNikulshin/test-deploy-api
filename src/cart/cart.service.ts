import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartDto } from './dto/cart.dto';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { plainToInstance } from 'class-transformer';
import { CartItemDto } from './dto/cart-item.dto';

const cartInclude = {
  items: {
    include: {
      product: true,
    },
  },
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string): Promise<CartDto> {
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const cart = await this.findOrCreateCart(userId);
    return this.mapCartToDto(cart);
  }

  async addToCart(
    userId: string,
    addToCartDto: AddToCartDto,
  ): Promise<CartDto> {
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const { productId, quantity } = addToCartDto;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const cart = await this.findOrCreateCart(userId);

    const existingItem = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { cartId_productId: { cartId: cart.id, productId } },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }

    const updatedCart = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: cartInclude,
    });
    return this.mapCartToDto(updatedCart);
  }

  async updateCartItem(
    userId: string,
    productId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartDto> {
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const cartId = await this.getCartId(userId);
    if (!cartId) throw new NotFoundException('Cart not found');

    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });
    if (!item) throw new NotFoundException('Product not found in cart');

    await this.prisma.cartItem.update({
      where: { cartId_productId: { cartId, productId } },
      data: { quantity: updateCartItemDto.quantity },
    });

    const updatedCart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: cartInclude,
    });
    return this.mapCartToDto(updatedCart);
  }

  async removeCartItem(userId: string, productId: string): Promise<CartDto> {
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const cartId = await this.getCartId(userId);
    if (!cartId) throw new NotFoundException('Cart not found');

    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });
    if (!item) throw new NotFoundException('Product not found in cart');

    await this.prisma.cartItem.delete({
      where: { cartId_productId: { cartId, productId } },
    });

    const updatedCart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: cartInclude,
    });
    return this.mapCartToDto(updatedCart);
  }

  async clearCart(userId: string): Promise<CartDto> {
    if (!userId) throw new UnauthorizedException('User not authenticated');
    const cartId = await this.getCartId(userId);
    if (!cartId) {
      const newCart = await this.findOrCreateCart(userId);
      return this.mapCartToDto(newCart);
    }

    await this.prisma.cartItem.deleteMany({ where: { cartId } });

    const updatedCart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: cartInclude,
    });
    return this.mapCartToDto(updatedCart);
  }

  private async findOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: cartInclude,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: cartInclude,
      });
    }
    return cart;
  }

  private async getCartId(userId: string): Promise<string | null> {
    if (!userId) return null;
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });
    return cart?.id || null;
  }

  private mapCartToDto(cart: any): CartDto {
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const total =
      cart.items?.reduce((acc, item) => {
        if (
          item &&
          item.product &&
          typeof item.quantity === 'number' &&
          typeof item.product.price === 'number'
        ) {
          return acc + item.quantity * item.product.price;
        }
        return acc;
      }, 0) ?? 0;

    const items = cart.items.map((item) =>
      plainToInstance(CartItemDto, {
        ...item,
        name: item.product.name,
        price: item.product.price,
        product: item.product,
      }),
    );

    return plainToInstance(CartDto, {
      id: cart.id,
      items,
      total,
    });
  }
}
