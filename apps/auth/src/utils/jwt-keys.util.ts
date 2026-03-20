import { ConfigService } from '@nestjs/config';
import { createPrivateKey, createPublicKey } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function normalizeKey(key?: string) {
  return key?.replace(/\\n/g, '\n');
}

function readKeyFromPath(pathValue?: string) {
  if (!pathValue) {
    return undefined;
  }

  const absolutePath = resolve(pathValue);
  return readFileSync(absolutePath, 'utf8');
}

function assertSupportedKeyFormat(key: string, keyType: 'private' | 'public') {
  const trimmedKey = key.trim();

  if (trimmedKey.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----')) {
    throw new Error(
      'OpenSSH private key format is not supported for JWT signing. Use PEM PKCS#8 private key (-----BEGIN PRIVATE KEY-----).',
    );
  }

  if (trimmedKey.startsWith('ssh-rsa ')) {
    throw new Error(
      'OpenSSH public key format (ssh-rsa ...) is not supported for JWT verification. Use PEM SPKI public key (-----BEGIN PUBLIC KEY-----).',
    );
  }

  const expectedPemHeader =
    keyType === 'private'
      ? '-----BEGIN PRIVATE KEY-----'
      : '-----BEGIN PUBLIC KEY-----';

  if (!trimmedKey.startsWith(expectedPemHeader)) {
    throw new Error(
      `Invalid JWT ${keyType} key format. Expected ${expectedPemHeader} PEM content.`,
    );
  }
}

function assertRsaKeyStrength(
  key: string,
  keyType: 'private' | 'public',
  minModulusBits: number,
) {
  let keyObject;

  try {
    keyObject =
      keyType === 'private' ? createPrivateKey(key) : createPublicKey(key);
  } catch {
    throw new Error(
      `Unable to parse JWT ${keyType} key. Make sure it is a valid PEM key and not encrypted with an unsupported format.`,
    );
  }

  if (keyObject.asymmetricKeyType !== 'rsa') {
    throw new Error(`JWT ${keyType} key must be RSA.`);
  }

  const modulusLength = keyObject.asymmetricKeyDetails?.modulusLength;
  if (modulusLength && modulusLength < minModulusBits) {
    throw new Error(
      `JWT ${keyType} key modulus must be at least ${minModulusBits} bits. Current: ${modulusLength}.`,
    );
  }
}

export function getJwtPrivateKey(configService: ConfigService) {
  const minModulusBits = Number(
    configService.get<string>('JWT_RSA_MIN_MODULUS', '4096'),
  );

  const privateKey =
    normalizeKey(configService.get<string>('JWT_PRIVATE_KEY')) ??
    readKeyFromPath(configService.get<string>('JWT_PRIVATE_KEY_PATH'));

  if (!privateKey) {
    throw new Error(
      'JWT private key not configured. Set JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_PATH.',
    );
  }

  assertSupportedKeyFormat(privateKey, 'private');

  assertRsaKeyStrength(privateKey, 'private', minModulusBits);

  return privateKey;
}

export function getJwtPublicKey(configService: ConfigService) {
  const minModulusBits = Number(
    configService.get<string>('JWT_RSA_MIN_MODULUS', '4096'),
  );

  const publicKey =
    normalizeKey(configService.get<string>('JWT_PUBLIC_KEY')) ??
    readKeyFromPath(configService.get<string>('JWT_PUBLIC_KEY_PATH'));

  if (!publicKey) {
    throw new Error(
      'JWT public key not configured. Set JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH.',
    );
  }

  assertSupportedKeyFormat(publicKey, 'public');

  assertRsaKeyStrength(publicKey, 'public', minModulusBits);

  return publicKey;
}
