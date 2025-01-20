// Assuming these imports based on your project structure
import * as rsaKeyUtils from './rsaKeyUtils';
import * as ecKeyUtils from './ecKeyUtils';
import { IX509Certificate, Jwk } from '../interfaces';
import { X509Certificate } from './x509';
import { wrapPem } from './pem';
import { KeyType } from 'crypto';

interface GenerateKeyPairOptions {
  modulusLength?: number; // for RSA
  namedCurve?: string; // for EC
}

export class KeyUtils {
  /**
   * Converts a JWK object to PEM format.
   * Delegates to RSA or EC specific utility based on the key type.
   */
  static jwkToPem(jwk: Jwk): string {
    if (jwk.kty === 'RSA') {
      // Expecting RSA properties: n and e
      if (!jwk.n || !jwk.e) {
        throw new Error('Invalid RSA JWK: missing modulus (n) or exponent (e)');
      }
      return rsaKeyUtils.rsaJwkToPem(jwk.n, jwk.e);
    } else if (jwk.kty === 'EC') {
      // Expecting EC properties: crv, x, y
      if (!jwk.crv || !jwk.x || !jwk.y) {
        throw new Error(
          'Invalid EC JWK: missing curve (crv) or coordinates (x, y)',
        );
      }
      return ecKeyUtils.ecJwkToPem(jwk.crv, jwk.x, jwk.y);
    } else {
      throw new Error(`Unsupported key type: ${jwk.kty}`);
    }
  }

  /**
   * Converts a PEM-encoded public key to JWK format.
   * Automatically detects if the key is RSA or EC.
   */
  static pemToJwk(pem: string): Jwk {
    // Basic heuristic: Check for EC curve OIDs or RSA public key headers.
    // For a more robust solution, parse the PEM structure to differentiate.
    if (
      pem.includes('BEGIN RSA PUBLIC KEY') ||
      pem.includes('BEGIN PUBLIC KEY')
    ) {
      const { n, e } = rsaKeyUtils.rsaPemToJwk(pem);
      return { kty: 'RSA', n, e };
    } else if (
      pem.includes('BEGIN EC PUBLIC KEY') ||
      pem.includes('BEGIN PUBLIC KEY')
    ) {
      const { crv, x, y } = ecKeyUtils.ecPemToJwk(pem);
      return { kty: 'EC', crv, x, y };
    } else {
      throw new Error('Unsupported PEM format or key type');
    }
  }

  /**
   * Generates a key pair (public and private keys) in PEM format.
   * Delegates to RSA or EC specific utility based on provided type.
   */
  static generateKeyPair(
    type: KeyType,
    options: GenerateKeyPairOptions = {},
  ): { publicKey: string; privateKey: string } {
    if (type === 'rsa') {
      const modulusLength = options.modulusLength || 2048;
      return rsaKeyUtils.generateRsaKeyPair(modulusLength);
    } else if (type === 'ec') {
      const namedCurve = options.namedCurve || 'P-256';
      return ecKeyUtils.generateEcKeyPair(namedCurve);
    } else {
      throw new Error(`Unsupported key type: ${type}`);
    }
  }

  /**
   * Generates a key pair and returns JWK representations.
   * Delegates to RSA or EC specific utility based on provided type.
   */
  static generateJwkKeyPair(
    type: KeyType,
    options: GenerateKeyPairOptions = {},
  ): { publicJwk: any; privateJwk: any } {
    if (type === 'rsa') {
      const modulusLength = options.modulusLength || 2048;
      return rsaKeyUtils.generateRsaJwkKeyPair(modulusLength);
    } else if (type === 'ec') {
      const namedCurve = options.namedCurve || 'P-256';
      return ecKeyUtils.generateEcJwkKeyPair(namedCurve);
    } else {
      throw new Error(`Unsupported key type: ${type}`);
    }
  }

  /**
   * Parses an X.509 certificate from PEM format and returns a human-readable text summary.
   */
  static parseCertificate(pem: string): string {
    const cert = X509Certificate.parse(pem);
    return cert.toText();
  }

  /**
   * Builds an X.509 certificate PEM from an in-memory certificate representation.
   */
  static buildCertificate(certData: IX509Certificate): string {
    const derCert = X509Certificate.buildX509Certificate(certData);
    const b64Cert = derCert.toString('base64');
    return wrapPem(b64Cert, 'CERTIFICATE');
  }
}
