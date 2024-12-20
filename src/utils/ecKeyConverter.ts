/**
 * @fileoverview
 * Utility functions for converting Elliptic Curve (EC) keys between different formats.
 * This module provides functionality to transform EC public keys from JSON Web Key (JWK) format
 * to Privacy-Enhanced Mail (PEM) format, facilitating interoperability with various cryptographic
 * libraries and systems that utilize PEM-encoded keys.
 *
 * @module src/utils/ecKeyConverter
 */

import { ClientError } from '../errors';
import { BinaryToTextEncoding } from '../enums';
import { base64UrlDecode } from './urlUtils';
import { wrapPem } from './pem';
import { bitString, objectIdentifier, sequence } from './derEncoding';

/**
 * Object Identifier (OID) for Elliptic Curve (EC) public keys as defined in SEC1.
 * Represents the algorithm identifier for EC.
 *
 * @constant {string}
 */
const EC_PUBLIC_KEY_OID = '1.2.840.10045.2.1';

/**
 * Mapping of supported Elliptic Curve names to their corresponding OIDs.
 * These OIDs are used to identify the specific curve in DER-encoded structures.
 *
 * @constant {Record<string, string>}
 */
const CURVE_OIDS: Record<string, string> = {
  'P-256': '1.2.840.10045.3.1.7',
  'P-384': '1.3.132.0.34',
  'P-521': '1.3.132.0.35',
};

/**
 * Converts an Elliptic Curve (EC) public key from JWK format to PEM format.
 *
 * This function takes the curve name (`crv`), and the `x` and `y` coordinates of the EC public key,
 * both encoded in Base64URL format, decodes them, and constructs a PEM-encoded public key
 * using DER encoding standards. The resulting PEM string can be used in various cryptographic
 * operations and libraries that require PEM-formatted keys.
 *
 * @param {string} crv - The name of the elliptic curve (e.g., 'P-256', 'P-384', 'P-521').
 * @param {string} x - The x-coordinate of the EC public key, Base64URL-encoded.
 * @param {string} y - The y-coordinate of the EC public key, Base64URL-encoded.
 * @returns {string} The PEM-encoded EC public key.
 *
 * @throws {ClientError} If the specified curve is unsupported or if the decoded coordinates
 *                         do not match the expected lengths for the given curve.
 *
 * @example
 * ```typescript
 * const crv = 'P-256';
 * const x = 'f83OJ3D2xF4...'; // Base64URL-encoded x-coordinate
 * const y = 'x_FEzRu9y...';    // Base64URL-encoded y-coordinate
 * const pem = ecJwkToPem(crv, x, y);
 * console.log(pem);
 * // Outputs:
 * // -----BEGIN PUBLIC KEY-----
 * // MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEf83OJ3D2xF4x_FEzRu9y...
 * // -----END PUBLIC KEY-----
 * ```
 */
export const ecJwkToPem = (crv: string, x: string, y: string): string => {
  // Retrieve the OID for the specified curve
  const curveOid = CURVE_OIDS[crv];
  if (!curveOid) {
    throw new ClientError(
      `Unsupported curve: ${crv}`,
      'ID_TOKEN_VALIDATION_ERROR',
    );
  }

  // Decode the x and y coordinates from Base64URL to Buffer
  const xBuffer = base64UrlDecode(x);
  const yBuffer = base64UrlDecode(y);

  // Determine the expected length of the coordinates based on the curve
  let expectedLength: number;
  switch (crv) {
    case 'P-256':
      expectedLength = 32;
      break;
    case 'P-384':
      expectedLength = 48;
      break;
    case 'P-521':
      expectedLength = 66;
      break;
    default:
      // This case should not occur due to the earlier curveOid check
      throw new ClientError(
        `Unsupported curve: ${crv}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
  }

  // Validate that the decoded coordinates have the correct length
  if (xBuffer.length !== expectedLength || yBuffer.length !== expectedLength) {
    throw new ClientError(
      'Invalid EC JWK: decoding failed or unexpected key size',
      'ID_TOKEN_VALIDATION_ERROR',
    );
  }

  // Construct the EC point in uncompressed form (0x04 || X || Y)
  const ecPoint = Buffer.concat([Buffer.from([0x04]), xBuffer, yBuffer]);

  // Encode the EC point as a DER BIT STRING
  const derEcPoint = bitString(ecPoint);

  // Create the algorithm identifier sequence (EC OID and curve OID)
  const algorithmIdentifier = sequence(
    Buffer.concat([
      objectIdentifier(EC_PUBLIC_KEY_OID),
      objectIdentifier(curveOid),
    ]),
  );

  // Create the SubjectPublicKeyInfo (SPKI) sequence
  const spki = sequence(Buffer.concat([algorithmIdentifier, derEcPoint]));

  // Convert the SPKI buffer to a Base64-encoded string
  const b64 = spki.toString(BinaryToTextEncoding.BASE_64);

  // Wrap the Base64 string with PEM headers and footers
  return wrapPem(b64, 'PUBLIC KEY');
};
