import { constants, verify } from 'crypto';
import { ClientError } from '../errors/ClientError';
import { JwksClient } from '../clients';
import { Jwk, JwtHeader } from '../interfaces';
import { Algorithm } from '../enums';
import { base64UrlDecode } from './urlUtils';
import { ecDsaSignatureFromRaw } from './derEncoding';
import { rsaJwkToPem } from './rsaKeyConverter';
import { ecJwkToPem } from './ecKeyConverter';

interface HashAlgorithm {
  name: string;
  options?: { saltLength?: number };
}

// Centralized algorithm to hash mapping
const ALGORITHM_HASH_MAP: Record<Algorithm, HashAlgorithm> = {
  RS256: { name: 'sha256' },
  RS384: { name: 'sha384' },
  RS512: { name: 'sha512' },
  PS256: { name: 'sha256', options: { saltLength: 32 } },
  PS384: { name: 'sha384', options: { saltLength: 48 } },
  PS512: { name: 'sha512', options: { saltLength: 64 } },
  ES256: { name: 'sha256' },
  ES384: { name: 'sha384' },
  ES512: { name: 'sha512' },
  HS256: { name: 'sha256' },
  HS384: { name: 'sha384' },
  HS512: { name: 'sha512' },
  SHA1: { name: 'sha1' },
  SHA256: { name: 'sha256' },
  SHA384: { name: 'sha384' },
  SHA512: { name: 'sha512' },
};

export class SignatureVerifier {
  constructor(private jwksClient: JwksClient) {}

  public async verify(header: JwtHeader, idToken: string): Promise<void> {
    const { kid, alg } = header;
    if (!kid || !alg) {
      throw new ClientError(
        'Missing kid or alg in header',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    const jwk = await this.jwksClient.getKey(kid);
    this.validateKeyForAlgorithm(jwk, alg);
    const pubKey = this.createPublicKeyFromJwk(jwk, alg);

    const { signingInput, sigBuffer } = this.extractSignatureParts(idToken);
    const { name: hashName, options } = this.getHashAlgorithm(alg);

    this.verifySignature(
      alg,
      hashName,
      signingInput,
      pubKey,
      sigBuffer,
      jwk,
      options,
    );
  }

  private extractSignatureParts(idToken: string): {
    signingInput: string;
    sigBuffer: Buffer;
  } {
    const segments = idToken.split('.');
    if (segments.length !== 3) {
      throw new ClientError('Invalid JWT format', 'ID_TOKEN_VALIDATION_ERROR');
    }

    const signingInput = `${segments[0]}.${segments[1]}`;
    const sigBuffer = base64UrlDecode(segments[2]);

    return { signingInput, sigBuffer };
  }

  private verifySignature(
    alg: Algorithm,
    hashName: string,
    signingInput: string,
    pubKey: string,
    sigBuffer: Buffer,
    jwk: Jwk,
    options?: { saltLength?: number },
  ): void {
    // A dictionary that maps kty to the verification strategy
    const verificationStrategies: Record<string, () => void> = {
      RSA: () =>
        this.verifyRsa(hashName, signingInput, pubKey, sigBuffer, alg, options),
      EC: () => this.verifyEc(hashName, signingInput, pubKey, sigBuffer, alg),
      // Add other kty strategies here if needed
    };

    const strategy = verificationStrategies[jwk.kty!];
    if (!strategy) {
      throw new ClientError(
        `Unsupported key type: ${jwk.kty}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    strategy();
  }

  private verifyRsa(
    hashName: string,
    signingInput: string,
    pubKey: string,
    sigBuffer: Buffer,
    alg: Algorithm,
    options?: { saltLength?: number },
  ): void {
    const verifyOptions: any = {
      key: pubKey,
      padding: alg.startsWith('PS')
        ? constants.RSA_PKCS1_PSS_PADDING
        : constants.RSA_PKCS1_PADDING,
      ...(options || {}),
    };

    const verified = verify(
      hashName,
      Buffer.from(signingInput),
      verifyOptions,
      sigBuffer,
    );

    if (!verified) {
      throw new ClientError(
        'Invalid ID token signature',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }

  private verifyEc(
    hashName: string,
    signingInput: string,
    pubKey: string,
    sigBuffer: Buffer,
    alg: Algorithm,
  ): void {
    const derSignature = ecDsaSignatureFromRaw(sigBuffer, alg);
    const verified = verify(
      hashName,
      Buffer.from(signingInput),
      { key: pubKey, dsaEncoding: 'der' },
      derSignature,
    );

    if (!verified) {
      throw new ClientError(
        'Invalid ID token signature',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }

  private createPublicKeyFromJwk(jwk: Jwk, alg: Algorithm): string {
    switch (jwk.kty) {
      case 'RSA':
        return rsaJwkToPem(jwk.n!, jwk.e!);
      case 'EC':
        return ecJwkToPem(jwk.crv!, jwk.x!, jwk.y!);
      default:
        throw new ClientError(
          `Unsupported key type: ${jwk.kty}`,
          'ID_TOKEN_VALIDATION_ERROR',
        );
    }
  }

  private getHashAlgorithm(alg: Algorithm): HashAlgorithm {
    const entry = ALGORITHM_HASH_MAP[alg];
    if (!entry) {
      throw new ClientError(
        `Unsupported or unimplemented algorithm: ${alg}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
    return entry;
  }

  private validateKeyForAlgorithm(jwk: Jwk, alg: Algorithm): void {
    // Key type requirements for specific algorithm prefixes
    const requiredKtyByAlgPrefix: Record<string, string> = {
      RS: 'RSA',
      PS: 'RSA',
      ES: 'EC',
      HS: 'oct',
    };

    const prefix = Object.keys(requiredKtyByAlgPrefix).find((p) =>
      alg.startsWith(p),
    );
    if (!prefix) {
      throw new ClientError(
        `Unsupported algorithm: ${alg}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    if (jwk.kty !== requiredKtyByAlgPrefix[prefix]) {
      throw new ClientError(
        `JWK kty mismatch. Expected ${requiredKtyByAlgPrefix[prefix]} for alg ${alg}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    if (jwk.alg && jwk.alg !== alg) {
      throw new ClientError(
        `JWK algorithm does not match JWT header alg. JWK: ${jwk.alg}, JWT: ${alg}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    // Validate EC curves
    if (alg === 'ES256' && jwk.crv !== 'P-256') {
      throw new ClientError(
        'Incorrect curve for ES256',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
    if (alg === 'ES384' && jwk.crv !== 'P-384') {
      throw new ClientError(
        'Incorrect curve for ES384',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
    if (alg === 'ES512' && jwk.crv !== 'P-521') {
      throw new ClientError(
        'Incorrect curve for ES512',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }
}
