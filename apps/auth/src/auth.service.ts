import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Auth } from './entities/auth.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { OAuthAuthorizeDto } from './dto/oauth-authorize.dto';
import { OAuthTokenDto } from './dto/oauth-token.dto';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { OAuthClient } from './entities/oauth-client.entity';
import { CreateOAuthClientDto } from './dto/create-oauth-client.dto';

type OAuthAuthorizationCode = {
  code: string;
  clientId: string;
  redirectUri: string;
  userId: number;
  email: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: 'plain' | 'S256';
  expiresAt: number;
};

@Injectable()
export class AuthService {
  private readonly authorizationCodes = new Map<string, OAuthAuthorizationCode>();

  constructor(
    @InjectRepository(Auth)
    private readonly authRepository: Repository<Auth>,
    @InjectRepository(OAuthClient)
    private readonly oauthClientRepository: Repository<OAuthClient>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createOAuthClient(createOAuthClientDto: CreateOAuthClientDto) {
    const clientId = createOAuthClientDto.client_id ?? randomUUID();

    const existingClient = await this.oauthClientRepository.findOne({
      where: { clientId },
    });

    if (existingClient) {
      throw new ConflictException('client_id já cadastrado');
    }

    const client = this.oauthClientRepository.create({
      clientId,
      name: createOAuthClientDto.name,
      redirectUri: createOAuthClientDto.redirect_uri,
      isActive: createOAuthClientDto.is_active ?? true,
    });

    const savedClient = await this.oauthClientRepository.save(client);

    return {
      client_id: savedClient.clientId,
      name: savedClient.name,
      redirect_uri: savedClient.redirectUri,
      is_active: savedClient.isActive,
      created_at: savedClient.createdAt,
    };
  }

  async signUp(signUpDto: SignUpDto) {
    const existingUser = await this.authRepository.findOne({
      where: { email: signUpDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const passwordHash = await bcrypt.hash(signUpDto.password, 10);

    const user = this.authRepository.create({
      email: signUpDto.email,
      password: passwordHash,
    });

    const savedUser = await this.authRepository.save(user);
    return this.buildTokenResponse(savedUser.id, savedUser.email);
  }

  async signIn(signInDto: SignInDto) {
    const user = await this.validateUser(signInDto.email, signInDto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.buildTokenResponse(user.id, user.email);
  }

  async authorize(oauthAuthorizeDto: OAuthAuthorizeDto) {
    await this.validateClientOrThrow(
      oauthAuthorizeDto.client_id,
      oauthAuthorizeDto.redirect_uri,
    );

    const user = await this.validateUser(
      oauthAuthorizeDto.email,
      oauthAuthorizeDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.validateCodeChallengeOrThrow(oauthAuthorizeDto.code_challenge);

    const code = randomUUID().replaceAll('-', '');
    const ttlSeconds = Number(
      this.configService.get('OAUTH_CODE_TTL_SECONDS', '300'),
    );
    const scope = oauthAuthorizeDto.scope ?? 'users.read users.write';

    this.authorizationCodes.set(code, {
      code,
      clientId: oauthAuthorizeDto.client_id,
      redirectUri: oauthAuthorizeDto.redirect_uri,
      userId: user.id,
      email: user.email,
      scope,
      codeChallenge: oauthAuthorizeDto.code_challenge,
      codeChallengeMethod: oauthAuthorizeDto.code_challenge_method,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    return {
      code,
      state: oauthAuthorizeDto.state,
      redirect_to: this.buildRedirectUrl(
        oauthAuthorizeDto.redirect_uri,
        code,
        oauthAuthorizeDto.state,
      ),
      expires_in: ttlSeconds,
      scope,
    };
  }

  async token(oauthTokenDto: OAuthTokenDto) {
    await this.validateClientOrThrow(
      oauthTokenDto.client_id,
      oauthTokenDto.redirect_uri,
    );
    this.validateCodeVerifierOrThrow(oauthTokenDto.code_verifier);

    const authCode = this.authorizationCodes.get(oauthTokenDto.code);
    if (!authCode) {
      throw new BadRequestException({
        error: 'invalid_grant',
        error_description: 'authorization code inválido',
      });
    }

    if (authCode.expiresAt < Date.now()) {
      this.authorizationCodes.delete(oauthTokenDto.code);
      throw new BadRequestException({
        error: 'invalid_grant',
        error_description: 'authorization code expirado',
      });
    }

    if (
      authCode.clientId !== oauthTokenDto.client_id ||
      authCode.redirectUri !== oauthTokenDto.redirect_uri
    ) {
      throw new BadRequestException({
        error: 'invalid_grant',
        error_description: 'client_id ou redirect_uri inválido para este code',
      });
    }

    const computedChallenge = this.computeCodeChallenge(
      oauthTokenDto.code_verifier,
      authCode.codeChallengeMethod,
    );

    if (computedChallenge !== authCode.codeChallenge) {
      throw new BadRequestException({
        error: 'invalid_grant',
        error_description: 'code_verifier inválido',
      });
    }

    this.authorizationCodes.delete(oauthTokenDto.code);

    const accessToken = await this.jwtService.signAsync({
      sub: authCode.userId,
      email: authCode.email,
      scope: authCode.scope,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: authCode.scope,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.authRepository.findOne({ where: { email } });
    if (!user) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
  }

  async getProfile(userId: number) {
    const user = await this.authRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  async verifyAccessToken(accessToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        email: string;
        scope?: string;
      }>(accessToken);

      return {
        valid: true,
        user: {
          id: payload.sub,
          email: payload.email,
          scope: payload.scope,
        },
      };
    } catch {
      return { valid: false };
    }
  }

  private async buildTokenResponse(userId: number, email: string) {
    const payload = { sub: userId, email };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      user: {
        id: userId,
        email,
      },
    };
  }

  private async validateClientOrThrow(clientId: string, redirectUri: string) {
    const oauthClient = await this.oauthClientRepository.findOne({
      where: { clientId, redirectUri, isActive: true },
    });

    if (!oauthClient) {
      throw new BadRequestException({
        error: 'invalid_client',
        error_description: 'client_id ou redirect_uri não autorizado',
      });
    }
  }

  private validateCodeChallengeOrThrow(codeChallenge: string) {
    const challengePattern = /^[A-Za-z0-9\-._~]{43,128}$/;
    if (!challengePattern.test(codeChallenge)) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'code_challenge inválido',
      });
    }
  }

  private validateCodeVerifierOrThrow(codeVerifier: string) {
    const verifierPattern = /^[A-Za-z0-9\-._~]{43,128}$/;
    if (!verifierPattern.test(codeVerifier)) {
      throw new BadRequestException({
        error: 'invalid_request',
        error_description: 'code_verifier inválido',
      });
    }
  }

  private computeCodeChallenge(
    codeVerifier: string,
    method: 'plain' | 'S256',
  ) {
    if (method === 'plain') {
      return codeVerifier;
    }

    return createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private buildRedirectUrl(redirectUri: string, code: string, state?: string) {
    const query = new URLSearchParams();
    query.set('code', code);
    if (state) {
      query.set('state', state);
    }

    return `${redirectUri}?${query.toString()}`;
  }
}
