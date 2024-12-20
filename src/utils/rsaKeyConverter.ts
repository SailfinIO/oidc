// src/utils/rsaKeyConverter.ts

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
  const algId = sequence(Buffer.concat([objectIdentifier(RSA_OID), derNull()]));

  // Create the SubjectPublicKeyInfo (SPKI) sequence
  const spki = sequence(Buffer.concat([algId, bitString(rsaPubKey)]));

  // Convert the SPKI buffer to a Base64-encoded string
  const b64 = spki.toString(BinaryToTextEncoding.BASE_64);

  // Wrap the Base64 string with PEM headers and footers
  return wrapPem(b64, 'PUBLIC KEY');
};
