// src/utils/rsaKeyUtils.ts

import { BinaryToTextEncoding, KeyExportOptions, KeyFormat } from '../enums';
import { base64UrlDecode } from './urlUtils';
import { pemToDer, wrapPem } from './pem';
import {
  integer,
  bitString,
  sequence,
  objectIdentifier,
  derNull,
} from './derUtils';
import { RSA_PUBLIC_KEY_OID } from '../constants/key-constants';
import { generateKeyPairSync } from 'crypto';

/**
 * Converts RSA public key components from JWK format to PEM format.
 *
 * @param {string} n - The modulus component of the RSA public key, Base64URL-encoded.
 * @param {string} e - The exponent component of the RSA public key, Base64URL-encoded.
 * @returns {string} The PEM-encoded RSA public key.
 *
 * @throws {Error} If the modulus (`n`) or exponent (`e`) cannot be decoded from Base64URL.
 */
export const rsaJwkToPem = (n: string, e: string): string => {
  let modulus: Buffer;
  let exponent: Buffer;

  // Attempt to decode the modulus
  try {
    modulus = base64UrlDecode(n);
  } catch (error) {
    throw new Error('Invalid modulus (n), could not decode base64url');
  }

  // Attempt to decode the exponent
  try {
    exponent = base64UrlDecode(e);
  } catch (error) {
    throw new Error('Invalid exponent (e), could not decode base64url');
  }

  // Validate decoded modulus
  if (modulus.length === 0) {
    throw new Error('Invalid modulus (n), could not decode base64url');
  }

  // Validate decoded exponent
  if (exponent.length === 0) {
    throw new Error('Invalid exponent (e), could not decode base64url');
  }

  // Encode the modulus and exponent as DER INTEGERs
  const modInt = integer(modulus);
  const expInt = integer(exponent);

  // Create the RSA public key sequence (modulus and exponent)
  const rsaPubKey = sequence(Buffer.concat([modInt, expInt]));

  // Create the algorithm identifier sequence with RSA OID and NULL parameters
  const algId = sequence(
    Buffer.concat([objectIdentifier(RSA_PUBLIC_KEY_OID), derNull()]),
  );

  // Create the SubjectPublicKeyInfo (SPKI) sequence
  const spki = sequence(Buffer.concat([algId, bitString(rsaPubKey)]));

  // Convert the SPKI buffer to a Base64-encoded string
  const b64 = spki.toString(BinaryToTextEncoding.BASE_64);

  // Wrap the Base64 string with PEM headers and footers
  return wrapPem(b64, 'PUBLIC KEY');
};

/**
 * Converts an RSA public key from PEM format to JWK format.
 *
 * This function takes a PEM-encoded RSA public key, extracts the modulus and
 * exponent from the key data, and returns the key components in JSON Web Key (JWK)
 * format. The JWK format is commonly used in web-based cryptographic operations
 * and JSON-based data interchange, providing a standard representation for RSA public keys.
 *
 * @param {string} pem - The PEM-encoded RSA public key.
 * @returns {object} An object containing the JWK components (`n`, `e`) of the RSA public key.
 *
 * @throws {Error} If the provided PEM string is not a valid RSA public key or if the key data
 *                 cannot be decoded from the PEM format.
 *
 * @example
 * ```typescript
 * const pemKey = `-----BEGIN PUBLIC KEY-----
 * MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
 * -----END PUBLIC KEY-----`;
 * const jwkKey = rsaPemToJwk(pemKey);
 * console.log(jwkKey);
 * // Outputs: { n: '...', e: '...' }
 * ```
 */
export const rsaPemToJwk = (pem: string): { n: string; e: string } => {
  // Convert the PEM string to a DER buffer
  const spki = pemToDer(pem);

  // Extract the modulus and exponent from the DER buffer
  const [modulus, exponent] = extractRsaComponents(spki);

  // Encode the modulus and exponent as Base64URL strings
  const n = modulus.toString(BinaryToTextEncoding.BASE_64);
  const e = exponent.toString(BinaryToTextEncoding.BASE_64);

  return { n, e };
};

/**
 * Extracts the modulus and exponent components from an RSA SubjectPublicKeyInfo (SPKI) buffer.
 *
 * This function parses an RSA SPKI buffer to extract the modulus and exponent components
 * of the RSA public key. The modulus is the first INTEGER value in the SPKI buffer, and
 * the exponent is the second INTEGER value.
 *
 * @param {Buffer} spki - The RSA SubjectPublicKeyInfo (SPKI) buffer.
 * @returns {Buffer[]} An array containing the modulus and exponent components.
 *
 * @throws {Error} If the provided SPKI buffer is not a valid RSA public key.
 */
const extractRsaComponents = (spki: Buffer): Buffer[] => {
  // Parse the SPKI buffer to extract the modulus and exponent
  const modulus = spki.subarray(1); // Skip the first byte (0x00) of the modulus
  const exponent = spki.subarray(modulus.length + 2); // Skip the modulus and padding byte

  return [modulus, exponent];
};

/**
 * Converts an RSA private key from PEM format to JWK format.
 *
 * This function takes a PEM-encoded RSA private key, extracts the modulus, public exponent,
 * private exponent, prime factors, and Chinese Remainder Theorem (CRT) components from the key data,
 * and returns the key components in JSON Web Key (JWK) format. The JWK format is commonly used
 * in web-based cryptographic operations and JSON-based data interchange, providing a standard
 * representation for RSA private keys.
 *
 * @param {string} pem - The PEM-encoded RSA private key.
 * @returns {object} An object containing the JWK components of the RSA private key.
 *
 * @throws {Error} If the provided PEM string is not a valid RSA private key or if the key data
 *                 cannot be decoded from the PEM format.
 *
 * @example
 * ```typescript
 * const pemKey = `-----BEGIN RSA PRIVATE KEY-----
 * MIIEpAIBAAKCAQEAw9T...
 * -----END RSA PRIVATE KEY-----`;
 * const jwkKey = rsaPrivateKeyPemToJwk(pemKey);
 * console.log(jwkKey);
 * // Outputs: { n: '...', e: '...', d: '...', p: '...', q: '...', dp: '...', dq: '...', qi: '...' }
 * ```
 */
export const rsaPrivateKeyPemToJwk = (
  pem: string,
): {
  n: string;
  e: string;
  d: string;
  p: string;
  q: string;
  dp: string;
  dq: string;
  qi: string;
} => {
  // Convert the PEM string to a DER buffer
  const pkcs8 = pemToDer(pem);

  // Extract the RSA private key components from the DER buffer
  const components = extractRsaPrivateKeyComponents(pkcs8);

  // Encode the components as Base64URL strings
  const n = components[0].toString(BinaryToTextEncoding.BASE_64);
  const e = components[1].toString(BinaryToTextEncoding.BASE_64);
  const d = components[2].toString(BinaryToTextEncoding.BASE_64);
  const p = components[3].toString(BinaryToTextEncoding.BASE_64);
  const q = components[4].toString(BinaryToTextEncoding.BASE_64);
  const dp = components[5].toString(BinaryToTextEncoding.BASE_64);
  const dq = components[6].toString(BinaryToTextEncoding.BASE_64);
  const qi = components[7].toString(BinaryToTextEncoding.BASE_64);

  return { n, e, d, p, q, dp, dq, qi };
};

/**
 * Extracts the RSA private key components from a PKCS#8 buffer.
 *
 * This function parses a PKCS#8 buffer to extract the RSA private key components
 * (modulus, public exponent, private exponent, prime factors, and CRT components).
 *
 * @param {Buffer} pkcs8 - The PKCS#8 buffer containing the RSA private key.
 * @returns {Buffer[]} An array containing the RSA private key components.
 *
 * @throws {Error} If the provided PKCS#8 buffer is not a valid RSA private key.
 */
const extractRsaPrivateKeyComponents = (pkcs8: Buffer): Buffer[] => {
  // Parse the PKCS#8 buffer to extract the RSA private key components
  const sequence = pkcs8.subarray(9); // Skip the PKCS#8 header
  const rsaPrivateKey = sequence.subarray(2); // Skip the RSA key header

  // Extract the RSA private key components
  const components = [];
  let offset = 0;

  for (let i = 0; i < 8; i++) {
    const len = rsaPrivateKey[offset + 1];
    components.push(rsaPrivateKey.subarray(offset + 2, offset + 2 + len));
    offset += 2 + len;
  }

  return components;
};

/**
 * Converts an RSA private key from JWK format to PEM format.
 *
 * @param {string} n - The modulus component of the RSA private key, Base64URL-encoded.
 * @param {string} e - The public exponent component of the RSA private key, Base64URL-encoded.
 * @param {string} d - The private exponent component of the RSA private key, Base64URL-encoded.
 * @param {string} p - The first prime factor component of the RSA private key, Base64URL-encoded.
 * @param {string} q - The second prime factor component of the RSA private key, Base64URL-encoded.
 * @param {string} dp - The first factor CRT exponent component of the RSA private key, Base64URL-encoded.
 * @param {string} dq - The second factor CRT exponent component of the RSA private key, Base64URL-encoded.
 * @param {string} qi - The CRT coefficient component of the RSA private key, Base64URL-encoded.
 * @returns {string} The PEM-encoded RSA private key.
 *
 * @throws {Error} If the modulus (`n`), public exponent (`e`), private exponent (`d`),
 *                 first prime factor (`p`), second prime factor (`q`), first CRT exponent (`dp`),
 *                 second CRT exponent (`dq`), or CRT coefficient (`qi`) cannot be decoded from Base64URL.
 * @throws {Error} If the provided RSA private key components are invalid or cannot be encoded to DER.
 * @throws {Error} If the RSA private key cannot be encoded to PEM format.
 *
 * @example
 * ```typescript
 * const jwkKey = {
 *  n: '...',
 *  e: '...',
 *  d: '...',
 *  p: '...',
 *  q: '...',
 *  dp: '...',
 *  dq: '...',
 *  qi: '...'
 * };
 * const pemKey = rsaPrivateKeyJwkToPem(jwkKey);
 * console.log(pemKey);
 */
export const rsaPrivateKeyJwkToPem = (
  n: string,
  e: string,
  d: string,
  p: string,
  q: string,
  dp: string,
  dq: string,
  qi: string,
): string => {
  let modulus: Buffer;
  let publicExponent: Buffer;
  let privateExponent: Buffer;
  let prime1: Buffer;
  let prime2: Buffer;
  let exp1: Buffer;
  let exp2: Buffer;
  let coeff: Buffer;

  // Attempt to decode the modulus
  try {
    modulus = base64UrlDecode(n);
  } catch (error) {
    throw new Error('Invalid modulus (n), could not decode base64url');
  }

  // Attempt to decode the public exponent
  try {
    publicExponent = base64UrlDecode(e);
  } catch (error) {
    throw new Error('Invalid public exponent (e), could not decode base64url');
  }

  // Attempt to decode the private exponent
  try {
    privateExponent = base64UrlDecode(d);
  } catch (error) {
    throw new Error('Invalid private exponent (d), could not decode base64url');
  }

  // Attempt to decode the first prime factor
  try {
    prime1 = base64UrlDecode(p);
  } catch (error) {
    throw new Error(
      'Invalid first prime factor (p), could not decode base64url',
    );
  }

  // Attempt to decode the second prime factor
  try {
    prime2 = base64UrlDecode(q);
  } catch (error) {
    throw new Error(
      'Invalid second prime factor (q), could not decode base64url',
    );
  }

  // Attempt to decode the first CRT exponent
  try {
    exp1 = base64UrlDecode(dp);
  } catch (error) {
    throw new Error(
      'Invalid first CRT exponent (dp), could not decode base64url',
    );
  }

  // Attempt to decode the second CRT exponent
  try {
    exp2 = base64UrlDecode(dq);
  } catch (error) {
    throw new Error(
      'Invalid second CRT exponent (dq), could not decode base64url',
    );
  }

  // Attempt to decode the CRT coefficient
  try {
    coeff = base64UrlDecode(qi);
  } catch (error) {
    throw new Error('Invalid CRT coefficient (qi), could not decode base64url');
  }

  // Validate decoded modulus
  if (modulus.length === 0) {
    throw new Error('Invalid modulus (n), could not decode base64url');
  }

  // Validate decoded public exponent
  if (publicExponent.length === 0) {
    throw new Error('Invalid public exponent (e), could not decode base64url');
  }

  // Validate decoded private exponent
  if (privateExponent.length === 0) {
    throw new Error('Invalid private exponent (d), could not decode base64url');
  }

  // Validate decoded first prime factor
  if (prime1.length === 0) {
    throw new Error(
      'Invalid first prime factor (p), could not decode base64url',
    );
  }

  // Validate decoded second prime factor

  if (prime2.length === 0) {
    throw new Error(
      'Invalid second prime factor (q), could not decode base64url',
    );
  }

  // Validate decoded first CRT exponent
  if (exp1.length === 0) {
    throw new Error(
      'Invalid first CRT exponent (dp), could not decode base64url',
    );
  }

  // Validate decoded second CRT exponent
  if (exp2.length === 0) {
    throw new Error(
      'Invalid second CRT exponent (dq), could not decode base64url',
    );
  }

  // Validate decoded CRT coefficient
  if (coeff.length === 0) {
    throw new Error('Invalid CRT coefficient (qi), could not decode base64url');
  }

  // Encode the components as DER-encoded buffers
  const modInt = integer(modulus);
  const pubExpInt = integer(publicExponent);
  const privExpInt = integer(privateExponent);
  const prime1Int = integer(prime1);
  const prime2Int = integer(prime2);
  const exp1Int = integer(exp1);
  const exp2Int = integer(exp2);
  const coeffInt = integer(coeff);

  // Create the RSA private key sequence (modulus, public exponent, private exponent, prime1, prime2, exp1, exp2, coeff)
  const rsaPrivKey = sequence(
    Buffer.concat([
      modInt,
      pubExpInt,
      privExpInt,
      prime1Int,
      prime2Int,
      exp1Int,
      exp2Int,
      coeffInt,
    ]),
  );

  // Create the algorithm identifier sequence with RSA OID and NULL parameters
  const algId = sequence(
    Buffer.concat([objectIdentifier(RSA_PUBLIC_KEY_OID), derNull()]),
  );
  const rsaPrivKeySeq = sequence(Buffer.concat([algId, rsaPrivKey]));

  // Convert the RSA private key buffer to a Base64-encoded string
  const b64 = rsaPrivKeySeq.toString(BinaryToTextEncoding.BASE_64);

  // Wrap the Base64 string with PEM headers and footers
  return wrapPem(b64, 'PRIVATE KEY');
};

/**
 * Generates an RSA key pair.
 *
 * @param {number} [modulusLength=2048] - The length of the RSA modulus in bits.
 * @returns {{ publicKey: string; privateKey: string }} An object containing PEM-encoded public and private keys.
 */
export const generateRsaKeyPair = (
  modulusLength = 2048,
): { publicKey: string; privateKey: string } => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength, // Length in bits
    publicKeyEncoding: {
      type: KeyExportOptions.SPKI,
      format: KeyFormat.PEM,
    },
    privateKeyEncoding: {
      type: KeyExportOptions.PKCS8,
      format: KeyFormat.PEM,
    },
  });

  return { publicKey, privateKey };
};

/**
 * Generates an RSA key pair and returns JWK representations.
 *
 * @param {number} [modulusLength=2048] - The length of the RSA modulus in bits.
 * @returns {object} An object containing both publicJwk and privateJwk.
 */
export const generateRsaJwkKeyPair = (modulusLength = 2048) => {
  const { publicKey, privateKey } = generateRsaKeyPair(modulusLength);

  const publicJwk = rsaPemToJwk(publicKey);
  const privateJwk = rsaPrivateKeyPemToJwk(privateKey);

  return { publicJwk, privateJwk };
};
