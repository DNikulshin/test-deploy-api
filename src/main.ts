import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Получаем ConfigService для доступа к переменным окружения
  const configService = app.get(ConfigService);
  const clientUrl = configService.get<string>('clientUrl');

  // Включаем и настраиваем CORS
  app.enableCors({
    origin: clientUrl,
    credentials: true, // Разрешаем передачу cookie
  });

  app.use(cookieParser());

  // Глобальное применение ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Отбрасывать свойства, не определенные в DTO
      transform: true, // Автоматически преобразовывать payload в экземпляры DTO
      transformOptions: {
        enableImplicitConversion: true, // Разрешить неявное преобразование типов
      },
    }),
  );

  // Глобальное применение ClassSerializerInterceptor
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription(`
The main API for the application. It includes several utility endpoints for monitoring and debugging:
<br>
<ul>
  <li><b>GET /health</b>: A simple health check endpoint. Returns the server status and a timestamp. Useful for uptime monitoring.</li>
  <li><b>GET /whoami</b>: A debugging endpoint to identify which container instance is handling the request. Useful for verifying load balancing in a multi-container setup.</li>
</ul>
`)
    .setVersion('1.0')
    .addCookieAuth('refreshToken')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
  });

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      requestInterceptor: (req: any) => {
        req.credentials = 'include';
        return req;
      },
    },
  });

  // Добавляем эндпоинт для скачивания документации в формате JSON
  const server = app.getHttpAdapter().getInstance();
  server.get('/docs-json', (req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(document));
  });

  const PORT = 3000;

  await app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/docs`);
    console.log(`Swagger JSON available at http://localhost:${PORT}/docs-json`);
  });
}
bootstrap();
