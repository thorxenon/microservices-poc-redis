import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
    const rmqUser = process.env.RMQ_USER ?? 'guest';
    const rmqPassword = process.env.RMQ_PASSWORD ?? 'guest';
    const rmqHost = process.env.RMQ_HOST ?? 'localhost';
    const rmqPort = Number(process.env.RMQ_PORT ?? 5672);
    const rmqQueue = process.env.RMQ_AUTH_QUEUE ?? 'auth_queue';

    const rmqUrl =
      process.env.RMQ_URL ??
      `amqp://${rmqUser}:${rmqPassword}@${rmqHost}:${rmqPort}`;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
        urls: [rmqUrl],
        queue: rmqQueue,
        queueOptions: {
          durable: true,
        },
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.startAllMicroservices();
  await app.listen(process.env.AUTH_PORT ?? 3000);
}
bootstrap();
