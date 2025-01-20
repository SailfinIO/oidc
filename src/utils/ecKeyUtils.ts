/**
 * @fileoverview
 * Utility functions for converting Elliptic Curve (EC) keys between different formats.
 * This module provides functionality to transform EC public keys from JSON Web Key (JWK) format
 * to Privacy-Enhanced Mail (PEM) format, facilitating interoperability with various cryptographic
 * libraries and systems that utilize PEM-encoded keys.
 *
 * @module src/utils/ecKeyUtils
 */

import { ClientError } from '../errors';
import {
  BinaryToTextEncoding,
  DERTag,
  KeyExportOptions,
  KeyFormat,
} from '../enums';
import { base64UrlDecode } from './urlUtils';
import { pemToDer, wrapPem } from './pem';
import { bitString, derNull, objectIdentifier, sequence } from './derUtils';
import {
  ALGORITHM_HASH_MAP,
  ATTRIBUTE_OID_MAP,
  CURVE_OIDS,
  EC_PUBLIC_KEY_OID,
} from '../constants/key-constants';
import {
  createPrivateKey,
  createPublicKey,
  createSign,
  generateKeyPairSync,
} from 'crypto';
import {
  IName,
  ISubjectPublicKeyInfo,
  ITbsCertificate,
  IValidity,
  IX509Certificate,
} from '../interfaces';
import { X509Certificate } from './x509';

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
      expectedLength = 32; // 256 bits
      break;
    case 'P-384':
      expectedLength = 48; // 384 bits
      break;
    case 'P-521':
      expectedLength = 66; // 521 bits
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
  const ecPoint = Buffer.concat([
    Buffer.from([DERTag.OCTET_STRING]),
    xBuffer,
    yBuffer,
  ]);

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

/**
 * Converts an Elliptic Curve (EC) public key from PEM format to JWK format.
 *
 * This function takes a PEM-encoded EC public key, extracts the x and y coordinates
 * from the key data, and returns the key components in JSON Web Key (JWK) format.
 * The JWK format is commonly used in web-based cryptographic operations and JSON-based
 * data interchange, providing a standard representation for EC public keys.
 *
 * @param {string} pem - The PEM-encoded EC public key.
 * @returns {object} An object containing the JWK components (`crv`, `x`, `y`) of the EC public key.
 *
 * @throws {ClientError} If the provided PEM string is not a valid EC public key or if the key data
 *                         cannot be decoded from the PEM format.
 *
 * @example
 * ```typescript
 * const pemKey = `-----BEGIN PUBLIC KEY-----
 * MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEf83OJ3D2xF4x_FEzRu9y...
 * -----END PUBLIC KEY-----`;
 * const jwk = ecPemToJwk(pemKey);
 * console.log(jwk);
 * // Outputs:
 * // {
 * //   crv: 'P-256',
 * //   x: 'f83OJ3D2xF4...',
 * //   y: 'x_FEzRu9y...'
 * // }
 * ```
 */
export const ecPemToJwk = (
  pem: string,
): { crv: string; x: string; y: string } => {
  // Convert the PEM string to a DER buffer
  const spki = pemToDer(pem);

  // Parse the SPKI structure to extract the curve OID and EC point
  const curveOid = spki.subarray(8, 15).toString(BinaryToTextEncoding.HEX);
  const ecPoint = spki.subarray(22);

  // Retrieve the curve name based on the curve OID
  const curveName = Object.entries(CURVE_OIDS).find(
    ([, oid]) => oid === curveOid,
  )?.[0];
  if (!curveName) {
    throw new ClientError(
      'Invalid EC public key: unsupported curve OID',
      'ID_TOKEN_VALIDATION_ERROR',
    );
  }

  // Extract the x and y coordinates from the EC point
  const xBuffer = ecPoint.subarray(2, 2 + 32);
  const yBuffer = ecPoint.subarray(2 + 32);

  // Convert the coordinates to Base64URL format
  const x = xBuffer.toString(BinaryToTextEncoding.BASE_64);
  const y = yBuffer.toString(BinaryToTextEncoding.BASE_64);

  return { crv: curveName, x, y };
};

/**
 * Converts an Elliptic Curve (EC) public key from JWK format to a SubjectPublicKeyInfo (SPKI) buffer.
 * This function is used internally to convert JWK public keys to SPKI format for use in cryptographic operations.
 *
 * @param {string} crv - The name of the elliptic curve (e.g., 'P-256', 'P-384', 'P-521').
 * @param {string} x - The x-coordinate of the EC public key, Base64URL-encoded.
 * @param {string} y - The y-coordinate of the EC public key, Base64URL-encoded.
 *
 * @returns {Buffer} The SPKI buffer representing the EC public key.
 */
export const ecJwkToSpki = (crv: string, x: string, y: string): Buffer => {
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
      expectedLength = 32; // 256 bits
      break;
    case 'P-384':
      expectedLength = 48; // 384 bits
      break;
    case 'P-521':
      expectedLength = 66; // 521 bits
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
  const ecPoint = Buffer.concat([
    Buffer.from([DERTag.OCTET_STRING]),
    xBuffer,
    yBuffer,
  ]);

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
  return sequence(Buffer.concat([algorithmIdentifier, derEcPoint]));
};

/**
 * Converts an Elliptic Curve (EC) public key from a SubjectPublicKeyInfo (SPKI) buffer to JWK format.
 * This function is used internally to convert SPKI public keys to JWK format for use in cryptographic operations.
 * The SPKI buffer is typically obtained from a certificate or other cryptographic structure.
 *
 * @param {Buffer} spki - The SPKI buffer representing the EC public key.
 * @returns {object} An object containing the JWK components (`crv`, `x`, `y`) of the EC public key.
 */
export const ecSpkiToJwk = (
  spki: Buffer,
): { crv: string; x: string; y: string } => {
  // Parse the SPKI structure to extract the curve OID and EC point
  const curveOid = spki.subarray(8, 15).toString(BinaryToTextEncoding.HEX);
  const ecPoint = spki.subarray(22);

  // Retrieve the curve name based on the curve OID
  const curveName = Object.entries(CURVE_OIDS).find(
    ([, oid]) => oid === curveOid,
  )?.[0];
  if (!curveName) {
    throw new ClientError(
      'Invalid EC public key: unsupported curve OID',
      'ID_TOKEN_VALIDATION_ERROR',
    );
  }

  // Extract the x and y coordinates from the EC point
  const xBuffer = ecPoint.subarray(2, 2 + 32);
  const yBuffer = ecPoint.subarray(2 + 32);

  // Convert the coordinates to Base64URL format
  const x = xBuffer.toString(BinaryToTextEncoding.BASE_64);
  const y = yBuffer.toString(BinaryToTextEncoding.BASE_64);

  return { crv: curveName, x, y };
};

/**
 * Converts an Elliptic Curve (EC) public key from a PEM-encoded X.509 certificate to JWK format.
 * This function is used to extract the public key from an X.509 certificate and convert it to JWK format.
 *
 * @param {string} pem - The PEM-encoded X.509 certificate containing the EC public key.
 * @returns {object} An object containing the JWK components (`crv`, `x`, `y`) of the EC public key.
 */
export const ecCertificateToJwk = (
  pem: string,
): { crv: string; x: string; y: string } => {
  // Convert the PEM string to a DER buffer
  const spki = pemToDer(pem);

  // Parse the SPKI structure to extract the curve OID and EC point
  const curveOid = spki.subarray(8, 15).toString(BinaryToTextEncoding.HEX);
  const ecPoint = spki.subarray(22);

  // Retrieve the curve name based on the curve OID
  const curveName = Object.entries(CURVE_OIDS).find(
    ([, oid]) => oid === curveOid,
  )?.[0];
  if (!curveName) {
    throw new ClientError(
      'Invalid EC public key: unsupported curve OID',
      'ID_TOKEN_VALIDATION_ERROR',
    );
  }

  // Extract the x and y coordinates from the EC point
  const xBuffer = ecPoint.subarray(2, 2 + 32);
  const yBuffer = ecPoint.subarray(2 + 32);

  // Convert the coordinates to Base64URL format
  const x = xBuffer.toString(BinaryToTextEncoding.BASE_64);
  const y = yBuffer.toString(BinaryToTextEncoding.BASE_64);

  return { crv: curveName, x, y };
};

/**
 * Signs data using the provided private key and hash algorithm.
 * @param data - The data to sign.
 * @param privateKeyPem - The PEM-encoded private key.
 * @param hashAlgorithm - The hash algorithm name (e.g., 'sha256').
 * @returns The signature as a Buffer.
 */
export function signData(
  data: Buffer,
  privateKeyPem: string,
  hashAlgorithm: string,
): Buffer {
  const sign = createSign(hashAlgorithm);
  sign.update(data);
  sign.end();
  return sign.sign(privateKeyPem);
}

/**
 * Generates a self-signed X.509 certificate PEM from an EC JWK using the provided private key.
 *
 * @param crv - The elliptic curve name (e.g., 'P-256').
 * @param x - The Base64URL-encoded x-coordinate of the EC public key.
 * @param y - The Base64URL-encoded y-coordinate of the EC public key.
 * @param privateKeyPem - The PEM-encoded EC private key for signing the certificate.
 * @param subjectName - The subject distinguished name (e.g., 'CN=example.com').
 * @returns PEM-encoded self-signed X.509 certificate.
 */
export function ecJwkToX509Certificate(
  crv: string,
  x: string,
  y: string,
  privateKeyPem: string,
  subjectName: string = 'CN=Example',
): string {
  // 1. Convert JWK to SubjectPublicKeyInfo
  const spkiBuffer = ecJwkToSpki(crv, x, y);

  // 2. Determine curve OID using constants
  const curveOid = CURVE_OIDS[crv];
  if (!curveOid) {
    throw new Error(`Unsupported curve: ${crv}`);
  }

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(now.getFullYear() + 1);

  // Parse subject name from input using ATTRIBUTE_OID_MAP for guidance
  const nameComponents = subjectName.split('=');
  const attributeType = nameComponents[0];
  const attributeValue = nameComponents[1];

  const typeOid =
    Object.keys(ATTRIBUTE_OID_MAP).find(
      (key) => ATTRIBUTE_OID_MAP[key] === attributeType,
    ) || '2.5.4.3'; // default to CN if not found

  const name: IName = {
    rdnSequence: [
      {
        attributes: [
          {
            type: typeOid,
            value: attributeValue,
          },
        ],
      },
    ],
  };

  const validity: IValidity = {
    notBefore: now,
    notAfter: oneYearLater,
  };

  // Build subjectPublicKeyInfo using constants for algorithm and curve parameters
  const subjectPublicKeyInfo: ISubjectPublicKeyInfo = {
    algorithm: {
      algorithm: EC_PUBLIC_KEY_OID,
      parameters: objectIdentifier(curveOid),
    },
    subjectPublicKey: (() => {
      const bitStringTag = 0x03;
      const index = spkiBuffer.indexOf(bitStringTag);
      if (index < 0) {
        throw new Error('BIT STRING not found in SPKI buffer');
      }
      return spkiBuffer.slice(index);
    })(),
  };

  // Use ES256 as an example algorithm for signing
  const signatureAlg = ALGORITHM_HASH_MAP.ES256;
  if (!signatureAlg) {
    throw new Error('Unsupported signature algorithm');
  }

  const tbsCertificate: ITbsCertificate = {
    version: 2, // X.509v3
    serialNumber: Buffer.from([0x01]), // Example serial number; should be unique
    signature: {
      // Use the algorithm identifier for ECDSA with SHA-256
      algorithm: signatureAlg.cryptoAlg,
      parameters: derNull(),
    },
    issuer: name,
    validity,
    subject: name,
    subjectPublicKeyInfo,
  };

  // Build TBS certificate DER before signing
  const tbsDer = X509Certificate.buildTbsCertificate(tbsCertificate);

  // Sign the TBS certificate using the provided private key and hash algorithm
  const signatureValue = signData(tbsDer, privateKeyPem, signatureAlg.hashName);

  const certificate: IX509Certificate = {
    tbsCertificate,
    signatureAlgorithm: tbsCertificate.signature,
    signatureValue,
  };

  // Build DER-encoded certificate
  const derCert = X509Certificate.buildX509Certificate(certificate);

  // Convert DER to PEM format
  const b64Cert = derCert.toString(BinaryToTextEncoding.BASE_64);
  const pemCert = wrapPem(b64Cert, 'CERTIFICATE');

  return pemCert;
}

/**
 * Generates an EC key pair in PEM format.
 *
 * @param {string} namedCurve - The name of the elliptic curve (e.g., 'P-256', 'P-384', 'P-521').
 * @returns {{ publicKey: string; privateKey: string }} An object containing PEM-encoded public and private keys.
 */
export const generateEcKeyPair = (
  namedCurve: string,
): { publicKey: string; privateKey: string } => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve,
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
 * Generates an EC key pair and returns JWK representations.
 *
 * @param {string} namedCurve - The name of the elliptic curve (e.g., 'P-256', 'P-384', 'P-521').
 * @returns {object} An object containing both publicJwk and privateJwk.
 */
export const generateEcJwkKeyPair = (namedCurve: string) => {
  // Generate EC key pair in PEM format
  const { publicKey, privateKey } = generateEcKeyPair(namedCurve);

  // Create KeyObjects from PEM strings
  const publicKeyObj = createPublicKey(publicKey);
  const privateKeyObj = createPrivateKey(privateKey);

  // Export keys directly to JWK format using Node.js crypto's export functionality
  const publicJwk = publicKeyObj.export({ format: KeyFormat.JWK });
  const privateJwk = privateKeyObj.export({ format: KeyFormat.JWK });

  return { publicJwk, privateJwk };
};
