import { IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class OAuthTokenDto {
  @IsString()
  @IsIn(['authorization_code'])
  grant_type: 'authorization_code';

  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  redirect_uri: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(43)
  code_verifier: string;
}
