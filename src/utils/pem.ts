/**
 * @fileoverview
 * Utility functions for handling Privacy-Enhanced Mail (PEM) encoding.
 * This module provides functionality to format Base64-encoded strings
 * into PEM format by adding appropriate headers and footers. PEM format
 * is commonly used for encoding cryptographic keys and certificates.
 *
 * @module src/utils/pem
 */

/**
 * Formats a Base64-encoded string into PEM format by adding
 * the appropriate header and footer lines.
 *
 * This function takes a Base64-encoded string and a label, splits the
 * string into lines of up to 64 characters, and wraps it with
 * `-----BEGIN {label}-----` and `-----END {label}-----` lines.
 * PEM format is widely used for encoding cryptographic keys and certificates.
 *
 * @param {string} b64 - The Base64-encoded string to wrap into PEM format.
 * @param {string} label - The label indicating the type of PEM content
 *                          (e.g., "PUBLIC KEY", "PRIVATE KEY", "CERTIFICATE").
 * @returns {string} The PEM-formatted string.
 *
 * @example
 * ```typescript
 * const base64Key = "MIIBIjANBgkqhkiG9w0BAQEFAAOC...";
 * const pemKey = wrapPem(base64Key, "PUBLIC KEY");
 * console.log(pemKey);
 * // Outputs:
 * // -----BEGIN PUBLIC KEY-----
 * // MIIBIjANBgkqhkiG9w0BAQEFAAOC...
 * // -----END PUBLIC KEY-----
 * ```
 */
export const wrapPem = (b64: string, label: string): string => {
  // Split the Base64 string into lines of up to 64 characters
  const lines = b64.match(/.{1,64}/g) || [];

  // Construct the PEM-formatted string with headers and footers
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
};
