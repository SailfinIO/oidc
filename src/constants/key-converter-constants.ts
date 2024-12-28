/**
 * Object Identifier (OID) for Elliptic Curve (EC) public keys as defined in SEC1.
 * Represents the algorithm identifier for EC.
 *
 * @constant {string}
 */
export const EC_PUBLIC_KEY_OID = '1.2.840.10045.2.1';

/**
 * Mapping of supported Elliptic Curve names to their corresponding OIDs.
 * These OIDs are used to identify the specific curve in DER-encoded structures.
 *
 * @constant {Record<string, string>}
 */
export const CURVE_OIDS: Record<string, string> = {
  'P-256': '1.2.840.10045.3.1.7',
  'P-384': '1.3.132.0.34',
  'P-521': '1.3.132.0.35',
};
