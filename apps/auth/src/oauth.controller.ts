import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OAuthAuthorizeDto } from './dto/oauth-authorize.dto';
import { OAuthTokenDto } from './dto/oauth-token.dto';
import { CreateOAuthClientDto } from './dto/create-oauth-client.dto';

@Controller('oauth')
export class OAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('clients')
  createClient(@Body() createOAuthClientDto: CreateOAuthClientDto) {
    return this.authService.createOAuthClient(createOAuthClientDto);
  }

  @Post('authorize')
  authorize(@Body() oauthAuthorizeDto: OAuthAuthorizeDto) {
    return this.authService.authorize(oauthAuthorizeDto);
  }

  @Post('token')
  token(@Body() oauthTokenDto: OAuthTokenDto) {
    return this.authService.token(oauthTokenDto);
  }
}
