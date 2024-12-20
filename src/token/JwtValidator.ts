// src/token/JwtValidator.ts

import { constants, verify } from 'crypto';
import { ClientError } from '../errors/ClientError';
import {
  IDiscoveryConfig,
  ILogger,
  Jwk,
  JwtHeader,
  JwtPayload,
} from '../interfaces';
import { JwksClient } from '../clients/JwksClient';
import { Algorithm, BinaryToTextEncoding } from '../enums';
import {
  base64UrlDecode,
  ecDsaSignatureFromRaw,
  ecJwkToPem,
  rsaJwkToPem,
} from '../utils';

export class JwtValidator {
  private readonly jwksClient: JwksClient;
  private readonly logger: ILogger;
  private readonly expectedIssuer: string;
  private readonly expectedAudience: string;

  constructor(
    logger: ILogger,
    discoveryConfig: IDiscoveryConfig,
    clientId: string,
  ) {
    this.logger = logger;
    this.jwksClient = new JwksClient(discoveryConfig.jwks_uri, this.logger);
    this.expectedIssuer = discoveryConfig.issuer;
    this.expectedAudience = clientId;
  }

  /**
   * Validates an ID token:
   * - Decodes the token
   * - Fetches the corresponding JWKS key
   * - Verifies the signature
   * - Checks issuer, audience, expiration, nonce
   */
  public async validateIdToken(
    idToken: string,
    nonce?: string,
  ): Promise<JwtPayload> {
    const { header, payload } = this.decodeJwt(idToken);

    // Validate issuer
    if (payload.iss !== this.expectedIssuer) {
      throw new ClientError(
        `Invalid issuer: ${payload.iss}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    // Validate audience
    const audArray = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audArray.includes(this.expectedAudience)) {
      throw new ClientError(
        'Audience not found in ID token',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    // Validate azp if multiple audiences
    if (
      audArray.length > 1 &&
      payload.azp &&
      payload.azp !== this.expectedAudience
    ) {
      throw new ClientError(
        'Invalid authorized party (azp) in ID token',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    // Validate expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new ClientError('ID token is expired', 'ID_TOKEN_VALIDATION_ERROR');
    }

    // Validate iat (issued at) - ensure it's not too far in the future
    // Allow some leeway for clock skew, e.g., 5 minutes (300 seconds)
    const maxFutureTime = now + 300;
    if (payload.iat && payload.iat > maxFutureTime) {
      throw new ClientError(
        'ID token issued-at time (iat) is too far in the future',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    // Validate nbf (not before) - token should not be used before this time
    if (payload.nbf && payload.nbf > now) {
      throw new ClientError(
        'ID token not valid yet (nbf)',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    // Validate nonce if provided
    if (nonce && payload.nonce !== nonce) {
      throw new ClientError(
        'Invalid nonce in ID token',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    // Verify signature
    await this.verifySignature(header, idToken);

    return payload;
  }

  private async verifySignature(
    header: JwtHeader,
    idToken: string,
  ): Promise<void> {
    const { kid, alg } = header;

    // Fetch the JWK based on kid
    const jwk = await this.jwksClient.getKey(kid);

    // Validate key type and algorithm
    this.validateKey(jwk, alg);

    let pubKey: string;

    if (jwk.kty === 'RSA') {
      pubKey = rsaJwkToPem(jwk.n!, jwk.e!);
    } else if (jwk.kty === 'EC') {
      pubKey = ecJwkToPem(jwk.crv!, jwk.x!, jwk.y!);
    } else {
      throw new ClientError(
        `Unsupported key type: ${jwk.kty}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    const segments = idToken.split('.');
    if (segments.length !== 3) {
      throw new ClientError(
        'Invalid ID token format',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    const signingInput = `${segments[0]}.${segments[1]}`;
    let signature = segments[2].replace(/_/g, '/').replace(/-/g, '+');
    // Ensure proper padding
    while (signature.length % 4 !== 0) {
      signature += '=';
    }
    const sigBuffer = Buffer.from(signature, BinaryToTextEncoding.BASE_64);

    const { name: hashName, options } = this.getHashAlgorithm(alg);

    if (jwk.kty === 'RSA') {
      // Handle RSA signatures
      if (alg.startsWith('RS') || alg.startsWith('PS')) {
        const verifyOptions: any = {
          key: pubKey,
          padding: constants.RSA_PKCS1_PADDING,
          // For RS* algorithms, padding is PKCS1
        };

        if (alg.startsWith('PS')) {
          verifyOptions.padding = constants.RSA_PKCS1_PSS_PADDING;
          verifyOptions.saltLength =
            options?.saltLength || constants.RSA_PSS_SALTLEN_DIGEST;
        }

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
      } else {
        throw new ClientError(
          `Unsupported RSA algorithm: ${alg}`,
          'ID_TOKEN_VALIDATION_ERROR',
        );
      }
    } else if (jwk.kty === 'EC') {
      // Handle ECDSA signatures
      if (alg.startsWith('ES')) {
        // ECDSA requires DER-encoded signature
        const derSignature = ecDsaSignatureFromRaw(sigBuffer, alg);
        const verifyOptions: any = {
          key: pubKey,
          dsaEncoding: 'der',
        };

        const verified = verify(
          hashName,
          Buffer.from(signingInput),
          verifyOptions,
          derSignature,
        );

        if (!verified) {
          throw new ClientError(
            'Invalid ID token signature',
            'ID_TOKEN_VALIDATION_ERROR',
          );
        }
      } else {
        throw new ClientError(
          `Unsupported EC algorithm: ${alg}`,
          'ID_TOKEN_VALIDATION_ERROR',
        );
      }
    } else {
      throw new ClientError(
        `Unsupported key type: ${jwk.kty}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }

  private getHashAlgorithm(alg: Algorithm): { name: string; options?: any } {
    const algMap: Record<Algorithm, { name: string; options?: any }> = {
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

    const entry = algMap[alg];
    if (!entry) {
      throw new ClientError(
        `Unsupported or unimplemented algorithm: ${alg}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
    return entry;
  }

  private validateKey(jwk: Jwk, alg: Algorithm): void {
    // Key Type Check
    if (alg.startsWith('RS') || alg.startsWith('PS')) {
      if (jwk.kty !== 'RSA') {
        throw new ClientError(
          `JWK kty mismatch. Expected RSA for alg ${alg}`,
          'ID_TOKEN_VALIDATION_ERROR',
        );
      }
    } else if (alg.startsWith('ES')) {
      if (jwk.kty !== 'EC') {
        throw new ClientError(
          `JWK kty mismatch. Expected EC for alg ${alg}`,
          'ID_TOKEN_VALIDATION_ERROR',
        );
      }
    } else {
      throw new ClientError(
        `Unsupported algorithm: ${alg}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    // Key Algorithm Check
    if (jwk.alg && jwk.alg !== alg) {
      throw new ClientError(
        `JWK algorithm does not match JWT header alg. JWK: ${jwk.alg}, JWT: ${alg}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    // Curve Matching for EC keys
    if (alg === Algorithm.ES256 && jwk.crv !== 'P-256') {
      throw new ClientError(
        'Incorrect curve for ES256',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
    if (alg === Algorithm.ES384 && jwk.crv !== 'P-384') {
      throw new ClientError(
        'Incorrect curve for ES384',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
    if (alg === Algorithm.ES512 && jwk.crv !== 'P-521') {
      throw new ClientError(
        'Incorrect curve for ES512',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }

  private decodeJwt(jwt: string): { header: JwtHeader; payload: JwtPayload } {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      throw new ClientError('Invalid JWT format', 'ID_TOKEN_VALIDATION_ERROR');
    }

    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf-8'));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf-8'));
    return { header, payload };
  }
}
