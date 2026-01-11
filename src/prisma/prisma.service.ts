import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get<string>('config.databaseUrl'),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async cleanDb() {
    // Порядок удаления важен из-за внешних ключей.
    // Сначала удаляем записи из связующих таблиц.
    return this.$transaction([
      this.orderProductItem.deleteMany(),
      this.cartItem.deleteMany(),
      this.order.deleteMany(),
      this.product.deleteMany(),
      this.cart.deleteMany(),
      this.user.deleteMany(),
    ]);
  }
}
