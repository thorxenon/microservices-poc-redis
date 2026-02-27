import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateOAuthClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  client_id?: string;

  @IsUrl({ require_tld: false }, { message: 'redirect_uri inválido' })
  redirect_uri: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
