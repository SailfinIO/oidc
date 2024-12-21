/**
 * @fileoverview
 * Utility functions for encoding data using Distinguished Encoding Rules (DER).
 * This module provides functions to encode various data types into DER format,
 * such as integers, bit strings, sequences, object identifiers, and ECDSA signatures.
 * It is primarily used for cryptographic operations where DER encoding is required.
 *
 * @module src/utils/derEncoding
 */

import { ClientError } from '../errors';
import { Algorithm } from '../enums';

/**
 * Tag value for a DER SEQUENCE.
 * @constant {number}
 */
export const SEQUENCE = 0x30;

/**
 * Tag value for a DER INTEGER.
 * @constant {number}
 */
export const INTEGER = 0x02;

/**
 * Tag value for a DER BIT STRING.
 * @constant {number}
 */
export const BIT_STRING = 0x03;

/**
 * Tag value for a DER NULL.
 * @constant {number}
 */
export const NULL_TAG = 0x05;

/**
 * Tag value for a DER OBJECT IDENTIFIER.
 * @constant {number}
 */
export const OBJECT_IDENTIFIER = 0x06;

/**
 * Encodes the length in DER format.
 *
 * @param {number} length - The length to encode.
 * @returns {Buffer} The DER-encoded length.
 *
 * @throws {RangeError} If the length is negative.
 */
export const encodeLength = (length: number): Buffer => {
  if (length < 0) {
    throw new RangeError('Length cannot be negative');
  }

  if (length < 128) {
    return Buffer.from([length]);
  }
  const lenBytes: number[] = [];
  let temp = length;
  while (temp > 0) {
    lenBytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return Buffer.from([0x80 | lenBytes.length, ...lenBytes]);
};

/**
 * Encodes a DER element with the given tag and content.
 *
 * @param {number} tag - The DER tag to use for encoding.
 * @param {Buffer} content - The content to encode.
 * @returns {Buffer} The DER-encoded element.
 */
export const encodeDER = (tag: number, content: Buffer): Buffer => {
  return Buffer.concat([
    Buffer.from([tag]),
    encodeLength(content.length),
    content,
  ]);
};

/**
 * Generates a DER-encoded NULL value.
 *
 * @returns {Buffer} The DER-encoded NULL.
 */
export const derNull = (): Buffer => {
  return Buffer.from([NULL_TAG, 0x00]);
};

/**
 * Formats a buffer representing an integer to ensure it adheres to DER encoding rules.
 * If the highest bit is set, a leading zero byte is added to prevent it from being interpreted as negative.
 *
 * @param {Buffer} numBuffer - The buffer representing the integer.
 * @returns {Buffer} The formatted integer buffer.
 */
const formatIntegerBuffer = (numBuffer: Buffer): Buffer => {
  if ((numBuffer[0] & 0x80) === 0x80) {
    return Buffer.concat([Buffer.from([0x00]), numBuffer]);
  }
  return numBuffer;
};

/**
 * Encodes a buffer as a DER INTEGER.
 *
 * @param {Buffer} numBuffer - The buffer representing the integer to encode.
 * @returns {Buffer} The DER-encoded INTEGER.
 */
export const integer = (numBuffer: Buffer): Buffer => {
  const formatted = formatIntegerBuffer(numBuffer);
  return encodeDER(INTEGER, formatted);
};

/**
 * Encodes data as a DER BIT STRING.
 *
 * @param {Buffer} data - The data to encode as a bit string.
 * @returns {Buffer} The DER-encoded BIT STRING.
 */
export const bitString = (data: Buffer): Buffer => {
  const full = Buffer.concat([Buffer.from([0x00]), data]);
  return encodeDER(BIT_STRING, full);
};

/**
 * Encodes contents as a DER SEQUENCE.
 *
 * @param {Buffer} contents - The concatenated DER-encoded elements to include in the sequence.
 * @returns {Buffer} The DER-encoded SEQUENCE.
 */
export const sequence = (contents: Buffer): Buffer => {
  return encodeDER(SEQUENCE, contents);
};

/**
 * Encodes a single value of an Object Identifier (OID) using DER rules.
 *
 * @param {number} value - The value to encode.
 * @returns {number[]} An array of bytes representing the encoded OID value.
 */
const encodeOidValue = (value: number): number[] => {
  const stack: number[] = [];
  let val = value;
  stack.push(val & 0x7f);
  val >>= 7;
  while (val > 0) {
    stack.unshift((val & 0x7f) | 0x80);
    val >>= 7;
  }
  return stack;
};

/**
 * Encodes a string representation of an Object Identifier (OID) into DER format.
 *
 * @param {string} oid - The OID string (e.g., "1.2.840.113549").
 * @returns {Buffer} The DER-encoded OBJECT IDENTIFIER.
 *
 * @throws {ClientError} If the OID is invalid or has fewer than two components.
 */
export const objectIdentifier = (oid: string): Buffer => {
  const parts = oid.split('.').map((p) => parseInt(p, 10));
  if (parts.length < 2 || parts.some(isNaN)) {
    throw new ClientError('Invalid OID', 'INVALID_OID');
  }

  const firstByte = 40 * parts[0] + parts[1];
  const rest = parts.slice(2);
  const oidBytes = [firstByte];
  for (const val of rest) {
    oidBytes.push(...encodeOidValue(val));
  }

  const buf = Buffer.from(oidBytes);
  return encodeDER(OBJECT_IDENTIFIER, buf);
};

/**
 * Converts a raw ECDSA signature into DER format.
 *
 * The raw signature is expected to be a concatenation of the `r` and `s` values.
 * This function splits the raw signature, encodes each component as a DER INTEGER,
 * and combines them into a DER SEQUENCE.
 *
 * @param {Buffer} rawSig - The raw ECDSA signature (r || s).
 * @param {Algorithm} alg - The ECDSA algorithm used (e.g., ES256, ES384, ES512).
 * @returns {Buffer} The DER-encoded ECDSA signature.
 *
 * @throws {ClientError} If the algorithm is unsupported or the signature length is invalid.
 */
export const ecDsaSignatureFromRaw = (
  rawSig: Buffer,
  alg: Algorithm,
): Buffer => {
  let keyLength: number;
  switch (alg) {
    case Algorithm.ES256:
      keyLength = 32;
      break;
    case Algorithm.ES384:
      keyLength = 48;
      break;
    case Algorithm.ES512:
      keyLength = 66;
      break;
    default:
      throw new ClientError(
        `Unsupported ECDSA algorithm: ${alg}`,
        'INVALID_ALGORITHM',
      );
  }

  if (rawSig.length !== 2 * keyLength) {
    throw new ClientError(
      'Invalid ECDSA signature length',
      'INVALID_SIGNATURE',
    );
  }

  const r = rawSig.subarray(0, keyLength);
  const s = rawSig.subarray(keyLength);

  const derR = integer(r);
  const derS = integer(s);

  return sequence(Buffer.concat([derR, derS]));
};
