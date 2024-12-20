/**
 * @fileoverview
 * Utility functions for converting RSA keys between different formats.
 * This module provides functionality to transform RSA keys from JSON Web Key (JWK) format
 * to Privacy-Enhanced Mail (PEM) format, facilitating interoperability with various cryptographic
 * libraries and systems that utilize PEM-encoded keys.
 *
 * @module src/utils/rsaKeyConverter
 */

import { BinaryToTextEncoding } from '../enums';
import { base64UrlDecode } from './urlUtils';
import { wrapPem } from './pem';
import {
  integer,
  bitString,
  sequence,
  objectIdentifier,
  derNull,
} from './derEncoding';

/**
 * Object Identifier (OID) for RSA encryption as defined in PKCS#1.
 * Represents the algorithm identifier for RSA.
 *
 * @constant {string}
 */
const RSA_OID = '1.2.840.113549.1.1.1';

/**
 * Converts RSA public key components from JWK format to PEM format.
 *
 * This function takes the modulus (`n`) and exponent (`e`) of an RSA public key,
 * both encoded in Base64URL format, decodes them, and constructs a PEM-encoded
 * public key using DER encoding standards. The resulting PEM string can be used
 * in various cryptographic operations and libraries that require PEM-formatted keys.
 *
 * @param {string} n - The modulus component of the RSA public key, Base64URL-encoded.
 * @param {string} e - The exponent component of the RSA public key, Base64URL-encoded.
 * @returns {string} The PEM-encoded RSA public key.
 *
 * @throws {Error} If the modulus (`n`) or exponent (`e`) cannot be decoded from Base64URL.
 *
 * @example
 * ```typescript
 * const n = 'sXch6...'; // Base64URL-encoded modulus
 * const e = 'AQAB'; // Base64URL-encoded exponent
 * const pem = rsaJwkToPem(n, e);
 * console.log(pem);
 * // Outputs:
 * // -----BEGIN PUBLIC KEY-----
 * // MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsXch6...
 * // -----END PUBLIC KEY-----
 * ```
 */
export const rsaJwkToPem = (n: string, e: string): string => {
  // Decode the modulus and exponent from Base64URL to Buffer
  const modulus = base64UrlDecode(n);
  const exponent = base64UrlDecode(e);

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
  const algId = sequence(Buffer.concat([objectIdentifier(RSA_OID), derNull()]));

  // Create the SubjectPublicKeyInfo (SPKI) sequence
  const spki = sequence(Buffer.concat([algId, bitString(rsaPubKey)]));

  // Convert the SPKI buffer to a Base64-encoded string
  const b64 = spki.toString(BinaryToTextEncoding.BASE_64);

  // Wrap the Base64 string with PEM headers and footers
  return wrapPem(b64, 'PUBLIC KEY');
};
