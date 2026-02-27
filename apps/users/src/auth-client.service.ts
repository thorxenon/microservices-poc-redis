import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

type VerifyTokenResponse = {
  valid: boolean;
  user?: {
    id: number;
    email: string;
    scope?: string;
  };
};

@Injectable()
export class AuthClientService {
  constructor(@Inject('AUTH_SERVICE') private readonly authClient: ClientProxy) {}

  async verifyToken(token: string) {
    const response = await firstValueFrom(
      this.authClient.send<VerifyTokenResponse>('auth.verify_token', { token }),
    );
    console.log(response);

    if (!response?.valid || !response.user) {
      throw new UnauthorizedException('Token inválido');
    }

    return response.user;
  }
}
