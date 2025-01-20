import { HashAlgorithm } from '../interfaces';
import { Algorithm, DERTag } from '../enums';

/**
 * Object Identifier (OID) for Elliptic Curve (EC) public keys as defined in SEC1.
 * Represents the algorithm identifier for EC.
 *
 * @constant {string}
 */
export const EC_PUBLIC_KEY_OID = '1.2.840.10045.2.1';

/**
 * Object Identifier (OID) for RSA public keys.
 * Represents the algorithm identifier for RSA.
 *
 * @constant {string}
 */
export const RSA_PUBLIC_KEY_OID = '1.2.840.113549.1.1.1';

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

// UTCTime format: YYMMDDHHMMSSZ (seconds optional, timezone 'Z' required)
export const UTC_REGEX = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/;

// GeneralizedTime format: YYYYMMDDHHMMSSZ (seconds optional, timezone 'Z' required)
export const GENERALIZED_TIME_REGEX =
  /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/;

export const ATTRIBUTE_OID_MAP: { [oid: string]: string } = {
  '2.5.4.3': 'CN', // Common Name
  '2.5.4.6': 'C', // Country Name
  '2.5.4.7': 'L', // Locality Name
  '2.5.4.8': 'ST', // State or Province Name
  '2.5.4.10': 'O', // Organization Name
  '2.5.4.11': 'OU', // Organizational Unit Name
  '2.5.4.5': 'SERIALNUMBER', // Serial Number
  '2.5.4.4': 'SN', // Surname
  '2.5.4.42': 'GIVENNAME', // Given Name
  '2.5.4.43': 'INITIALS', // Initials
  '2.5.4.44': 'GENERATIONQUALIFIER', // Generation Qualifier
  '2.5.4.65': 'PSEUDONYM', // Pseudonym
  '2.5.4.9': 'STREET', // Street Address
  '2.5.4.46': 'DNQUALIFIER', // Distinguished Name Qualifier
  '1.2.840.113549.1.9.1': 'E', // Email Address
  '0.9.2342.19200300.100.1.25': 'DC', // Domain Component
  '0.9.2342.19200300.100.1.1': 'UID', // User ID or User Identifier
};

/**
 * Defines the ASN.1 string type for known attribute OIDs.
 */
export const ATTRIBUTE_ASN1_TYPES: { [oid: string]: DERTag } = {
  // Common attribute types
  '2.5.4.3': DERTag.UTF8_STRING, // Common Name (CN)
  '2.5.4.6': DERTag.PRINTABLE_STRING, // Country Name (C)
  '2.5.4.7': DERTag.UTF8_STRING, // Locality Name (L)
  '2.5.4.8': DERTag.UTF8_STRING, // State or Province Name (ST)
  '2.5.4.10': DERTag.UTF8_STRING, // Organization Name (O)
  '2.5.4.11': DERTag.UTF8_STRING, // Organizational Unit Name (OU)
  '2.5.4.5': DERTag.UTF8_STRING, // Serial Number
  '2.5.4.4': DERTag.UTF8_STRING, // Surname (SN)
  '2.5.4.42': DERTag.UTF8_STRING, // Given Name
  '2.5.4.43': DERTag.UTF8_STRING, // Initials
  '2.5.4.44': DERTag.UTF8_STRING, // Generation Qualifier
  '2.5.4.65': DERTag.UTF8_STRING, // Pseudonym
  '2.5.4.9': DERTag.UTF8_STRING, // Street Address
  '2.5.4.46': DERTag.UTF8_STRING, // DN Qualifier
  '1.2.840.113549.1.9.1': DERTag.IA5_STRING, // Email Address (E)
};

export const ALGORITHM_HASH_MAP: Record<Algorithm, HashAlgorithm> = {
  RS256: { cryptoAlg: 'RSA-SHA256', hashName: 'sha256' },
  RS384: { cryptoAlg: 'RSA-SHA384', hashName: 'sha384' },
  RS512: { cryptoAlg: 'RSA-SHA512', hashName: 'sha512' },
  PS256: {
    cryptoAlg: 'RSA-PSS',
    hashName: 'sha256',
    options: { saltLength: 32 },
  },
  PS384: {
    cryptoAlg: 'RSA-PSS',
    hashName: 'sha384',
    options: { saltLength: 48 },
  },
  PS512: {
    cryptoAlg: 'RSA-PSS',
    hashName: 'sha512',
    options: { saltLength: 64 },
  },
  HS256: { cryptoAlg: 'sha256', hashName: 'sha256' },
  HS384: { cryptoAlg: 'sha384', hashName: 'sha384' },
  HS512: { cryptoAlg: 'sha512', hashName: 'sha512' },
  ES256: { cryptoAlg: 'ecdsa-with-SHA256', hashName: 'sha256' },
  ES384: { cryptoAlg: 'ecdsa-with-SHA384', hashName: 'sha384' },
  ES512: { cryptoAlg: 'ecdsa-with-SHA512', hashName: 'sha512' },
  SHA1: { cryptoAlg: 'sha1', hashName: 'sha1' },
  SHA256: { cryptoAlg: 'sha256', hashName: 'sha256' },
  SHA384: { cryptoAlg: 'sha384', hashName: 'sha384' },
  SHA512: { cryptoAlg: 'sha512', hashName: 'sha512' },
};
