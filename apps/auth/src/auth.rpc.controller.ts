import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';

@Controller()
export class AuthRpcController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern('auth.verify_token')
  verifyToken(@Payload() payload: { token: string }) {
    return this.authService.verifyAccessToken(payload.token);
  }
}
