import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthClientService } from '../auth-client.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(private readonly authClientService: AuthClientService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		const authorization = request.headers.authorization;

		if (!authorization || !authorization.startsWith('Bearer ')) {
			throw new UnauthorizedException('Token não informado');
		}

		const token = authorization.replace('Bearer ', '').trim();
		const user = await this.authClientService.verifyToken(token);
		(request as Request & { user: typeof user }).user = user;

		return true;
	}
}
