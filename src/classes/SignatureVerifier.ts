/**
 * @fileoverview
 * Defines the `SignatureVerifier` class, responsible for verifying the signature
 * of a JWT using public keys retrieved from a JWKS endpoint. The class supports
 * multiple key types and algorithms.
 *
 * @module src/utils/SignatureVerifier
 */

import { constants, verify } from 'crypto';
import { ClientError } from '../errors/ClientError';
import { IJwks, ISignatureVerifier, Jwk, JwtHeader } from '../interfaces';
import { Algorithm } from '../enums';
import {
  base64UrlDecode,
  ecDsaSignatureFromRaw,
  rsaJwkToPem,
  ecJwkToPem,
} from '../utils';

/**
 * Represents the hash algorithm and optional parameters for a given algorithm.
 *
 * @interface HashAlgorithm
 */
interface HashAlgorithm {
  /**
   * The name of the hash algorithm (e.g., 'sha256').
   *
   * @type {string}
   */
  name: string;

  /**
   * Optional parameters for the hash algorithm (e.g., salt length for RSA-PSS).
   *
   * @type {{ saltLength?: number }}
   */
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

/**
 * Verifies the signature of a JWT using a public key fetched from a JWKS endpoint.
 *
 * The `SignatureVerifier` class supports RSA, EC, and other key types, and
 * validates algorithms, key compatibility, and signature correctness.
 *
 * @class SignatureVerifier
 */
export class SignatureVerifier implements ISignatureVerifier {
  /**
   * Creates an instance of `SignatureVerifier`.
   *
   * @param {IJwks} jwks - The client used to fetch JWKS keys.
   * @readonly
   */
  constructor(private readonly jwks: IJwks) {}

  /**
   * Verifies the signature of a JWT.
   *
   * @param {JwtHeader} header - The JWT header containing algorithm and key ID.
   * @param {string} idToken - The JWT to verify.
   * @throws {ClientError} If the signature is invalid or verification fails.
   */
  public async verify(header: JwtHeader, idToken: string): Promise<void> {
    const { kid, alg } = header;
    if (!kid || !alg) {
      throw new ClientError(
        'Missing kid or alg in header',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    const jwk = await this.jwks.getKey(kid);
    this.validateKeyForAlgorithm(jwk, alg);
    const pubKey = this.createPublicKeyFromJwk(jwk);

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

  /**
   * Extracts the signing input and signature buffer from a JWT.
   *
   * @private
   * @param {string} idToken - The JWT to extract parts from.
   * @returns {Object} An object containing `signingInput` and `sigBuffer`.
   * @throws {ClientError} If the JWT format is invalid.
   */
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

  /**
   * Verifies the signature of the JWT based on the algorithm and key type.
   *
   * @private
   * @param {Algorithm} alg - The algorithm used for signing.
   * @param {string} hashName - The hash algorithm name (e.g., 'sha256').
   * @param {string} signingInput - The input used to generate the signature.
   * @param {string} pubKey - The public key used for verification.
   * @param {Buffer} sigBuffer - The signature buffer.
   * @param {Jwk} jwk - The JSON Web Key used in verification.
   * @param {{ saltLength?: number }} [options] - Optional parameters for verification.
   * @throws {ClientError} If the signature verification fails.
   */
  private verifySignature(
    alg: Algorithm,
    hashName: string,
    signingInput: string,
    pubKey: string,
    sigBuffer: Buffer,
    jwk: Jwk,
    options?: { saltLength?: number },
  ): void {
    const verificationStrategies: Record<string, () => void> = {
      RSA: () =>
        this.verifyRsa(hashName, signingInput, pubKey, sigBuffer, alg, options),
      EC: () => this.verifyEc(hashName, signingInput, pubKey, sigBuffer, alg),
    };

    const strategy = verificationStrategies[jwk.kty];
    if (!strategy) {
      throw new ClientError(
        `Unsupported key type: ${jwk.kty}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }

    strategy();
  }

  /**
   * Verifies an RSA signature.
   *
   * @private
   */
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

  /**
   * Verifies an ECDSA signature.
   *
   * @private
   */
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

  /**
   * Maps an algorithm to its corresponding hash function and options.
   *
   * @private
   */
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

  /**
   * Creates a public key from a JWK for the specified algorithm.
   *
   * @private
   */
  private createPublicKeyFromJwk(jwk: Jwk): string {
    switch (jwk.kty) {
      case 'RSA':
        return rsaJwkToPem(jwk.n, jwk.e);
      case 'EC':
        return ecJwkToPem(jwk.crv, jwk.x, jwk.y);
      default:
        throw new ClientError(
          `Unsupported key type: ${jwk.kty}`,
          'ID_TOKEN_VALIDATION_ERROR',
        );
    }
  }

  /**
   * Validates that a JWK is compatible with the specified algorithm.
   *
   * @private
   */
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
