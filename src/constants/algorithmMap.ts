// src/enums/JwtToCryptoAlgorithmMap.ts

import { HashAlgorithm } from '../interfaces';
import { Algorithm } from '../enums';

/**
 * Maps JWT Algorithm enum values to Node.js crypto algorithm names.
 */
export const ALGORITHM_HASH_MAP: Record<Algorithm, HashAlgorithm> = {
  RS256: { cryptoAlg: 'RSA-SHA256', hashName: 'sha256' },
  RS384: { cryptoAlg: 'RSA-SHA384', hashName: 'sha384' },
  RS512: { cryptoAlg: 'RSA-SHA512', hashName: 'sha512' },
  PS256: {
    cryptoAlg: 'RSA-PSS',
    hashName: 'sha256',
    options: { saltLength: 32 },
  },
  PS384: {
    cryptoAlg: 'RSA-PSS',
    hashName: 'sha384',
    options: { saltLength: 48 },
  },
  PS512: {
    cryptoAlg: 'RSA-PSS',
    hashName: 'sha512',
    options: { saltLength: 64 },
  },
  HS256: { cryptoAlg: 'sha256', hashName: 'sha256' },
  HS384: { cryptoAlg: 'sha384', hashName: 'sha384' },
  HS512: { cryptoAlg: 'sha512', hashName: 'sha512' },
  ES256: { cryptoAlg: 'ecdsa-with-SHA256', hashName: 'sha256' },
  ES384: { cryptoAlg: 'ecdsa-with-SHA384', hashName: 'sha384' },
  ES512: { cryptoAlg: 'ecdsa-with-SHA512', hashName: 'sha512' },
  SHA1: { cryptoAlg: 'sha1', hashName: 'sha1' },
  SHA256: { cryptoAlg: 'sha256', hashName: 'sha256' },
  SHA384: { cryptoAlg: 'sha384', hashName: 'sha384' },
  SHA512: { cryptoAlg: 'sha512', hashName: 'sha512' },
};
