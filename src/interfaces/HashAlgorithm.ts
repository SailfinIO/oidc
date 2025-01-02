/**
 * Represents the hash algorithm and optional parameters for a given algorithm.
 *
 * @interface HashAlgorithm
 */
export interface HashAlgorithm {
  /**
   * The name of the hash algorithm (e.g., 'sha256').c
   *
   * @type {string}
   */
  hashName: string;

  /**
   * Optional parameters for the hash algorithm (e.g., salt length for RSA-PSS).
   *
   * @type {{ saltLength?: number }}
   */
  options?: { saltLength?: number };

  /**
   * The name of the Node.js crypto algorithm (e.g., 'RSA-SHA256').
   *
   * @type {string}
   */
  cryptoAlg: string;
}
