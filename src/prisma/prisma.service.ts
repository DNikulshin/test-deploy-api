import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly config: ConfigService) {
    const databaseUrl = config.get<string>('config.databaseUrl');
    // --- DIAGNOSTIC LOG ---
    console.log(`[PrismaService] Attempting to connect with URL: ${databaseUrl}`);
    // ---------------------
    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async cleanDb() {
    // ...
  }
}
