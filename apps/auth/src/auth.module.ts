import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Auth } from './entities/auth.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OAuthController } from './oauth.controller';
import { AuthRpcController } from './auth.rpc.controller';
import { OAuthClient } from './entities/oauth-client.entity';
import { getJwtPrivateKey, getJwtPublicKey } from './utils/jwt-keys.util';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './apps/auth/.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: Number(configService.get('DB_PORT')),
        username: configService.get('DB_USER'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_AUTH_SERVICE_NAME'),
        entities: [Auth, OAuthClient],
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([Auth, OAuthClient]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        privateKey: getJwtPrivateKey(configService),
        publicKey: getJwtPublicKey(configService),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: '1h',
          issuer: configService.get<string>('JWT_ISSUER', 'auth-service'),
          audience: configService.get<string>('JWT_AUDIENCE', 'microservices'),
        },
        verifyOptions: {
          algorithms: ['RS256'],
          issuer: configService.get<string>('JWT_ISSUER', 'auth-service'),
          audience: configService.get<string>('JWT_AUDIENCE', 'microservices'),
        },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController, AuthRpcController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
})
export class AuthModule {}
