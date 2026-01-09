import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OrderStatus, Prisma } from '@prisma/client';

const include = {
  products: {
    include: {
      product: true,
    },
  },
};

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { products } = createOrderDto;

    if (!userId) {
      throw new Error('Attempted to create order without a user ID');
    }

    await this.userService.findOne(userId);

    const productsWithPrice = await Promise.all(
      products.map(async (p) => {
        try {
          const product = await this.prisma.product.findUniqueOrThrow({
            where: { id: p.productId },
          });
          return {
            ...p,
            price: product.price,
          };
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          ) {
            throw new NotFoundException(
              `Product with ID "${p.productId}" not found`,
            );
          }
          throw e;
        }
      }),
    );

    const totalPrice = productsWithPrice.reduce(
      (acc, p) => acc + p.price * p.quantity,
      0,
    );

    const orderId = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          status: OrderStatus.PENDING,
          totalPrice,
          user: {
            connect: { id: userId },
          },
          products: {
            create: productsWithPrice.map((p) => ({
              quantity: p.quantity,
              productId: p.productId,
              price: p.price,
            })),
          },
        },
      });

      const cart = await tx.cart.findUnique({
        where: { userId },
      });

      if (cart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });
      }

      return createdOrder.id;
    });

    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include,
    });
  }

  findAll(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include,
    });
  }

  findAllForAdmin() {
    return this.prisma.order.findMany({
      include,
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include,
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }
    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    await this.findOne(id);
    const { products, status } = updateOrderDto;

    let productsWithPrice;
    if (products) {
      productsWithPrice = await Promise.all(
        products.map(async (p) => {
          try {
            const product = await this.prisma.product.findUniqueOrThrow({
              where: { id: p.productId },
            });
            return {
              ...p,
              price: product.price,
            };
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === 'P2025'
            ) {
              throw new NotFoundException(
                `Product with ID "${p.productId}" not found`,
              );
            }
            throw e;
          }
        }),
      );
    }

    const totalPrice = productsWithPrice
      ? productsWithPrice.reduce((acc, p) => acc + p.price * p.quantity, 0)
      : undefined;

    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(totalPrice !== undefined && { totalPrice }),
        ...(products && {
          products: {
            deleteMany: {},
            create: productsWithPrice.map((p) => ({
              quantity: p.quantity,
              productId: p.productId,
              price: p.price,
            })),
          },
        }),
      },
      include,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.order.delete({ where: { id } });
  }
}
