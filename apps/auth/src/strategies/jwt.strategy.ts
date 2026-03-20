import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtPublicKey } from '../utils/jwt-keys.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtPublicKey(configService),
      algorithms: ['RS256'],
      issuer: configService.get<string>('JWT_ISSUER', 'auth-service'),
      audience: configService.get<string>('JWT_AUDIENCE', 'microservices'),
    });
  }

  validate(payload: { sub: number; email: string }) {
    return payload;
  }
}
