import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthClientService } from './auth-client.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './apps/users/.env',
    }),
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const rmqUrl =
            configService.get<string>('RMQ_URL') ??
            `amqp://${configService.get<string>('RMQ_USER', 'guest')}:${configService.get<string>('RMQ_PASSWORD', 'guest')}@${configService.get<string>('RMQ_HOST', 'localhost')}:${configService.get<number>('RMQ_PORT', 5672)}`;

          return {
            transport: Transport.RMQ,
            options: {
              urls: [rmqUrl],
              queue: configService.get<string>('RMQ_AUTH_QUEUE', 'auth_queue'),
              queueOptions: {
                durable: true,
              },
            },
          };
        },
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, AuthClientService],
})
export class UsersModule {}
