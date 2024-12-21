/**
 * @fileoverview
 * Enumeration of binary-to-text encoding schemes.
 * This module defines the `BinaryToTextEncoding` enum, which lists supported
 * encoding formats for converting binary data to textual representations
 * and vice versa. These encodings are commonly used in cryptographic operations
 * and data serialization/deserialization processes.
 *
 * @module src/enums/BinaryToTextEncoding
 */

/**
 * Represents the supported binary-to-text encoding schemes.
 *
 * The `BinaryToTextEncoding` enum lists the encoding formats available
 * for converting binary data into text and decoding text back into binary data.
 * These encodings include Base64URL, Base64, and Hexadecimal.
 *
 * @enum {string}
 */
export enum BinaryToTextEncoding {
  /**
   * Base64URL encoding, which is URL-safe by replacing `+` with `-` and `/` with `_`,
   * and removing padding characters.
   *
   * @member {string} BinaryToTextEncoding.BASE_64_URL
   */
  BASE_64_URL = 'base64url',

  /**
   * Standard Base64 encoding, which uses `+` and `/` characters and may include padding.
   *
   * @member {string} BinaryToTextEncoding.BASE_64
   */
  BASE_64 = 'base64',

  /**
   * Hexadecimal encoding, representing binary data as a string of hexadecimal digits.
   *
   * @member {string} BinaryToTextEncoding.HEX
   */
  HEX = 'hex',
}
