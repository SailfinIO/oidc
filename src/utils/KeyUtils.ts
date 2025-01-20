// Assuming these imports based on your project structure
import * as rsaKeyUtils from './rsaKeyUtils';
import * as ecKeyUtils from './ecKeyUtils';
import { IValidity, IX509Certificate, Jwk } from '../interfaces';
import { X509Certificate } from './x509';
import { wrapPem } from './pem';
import { createVerify, KeyType } from 'crypto';
import { Algorithm, BinaryToTextEncoding, EcCurve } from '../enums';
import { RsaCertificate } from './RSACertificate';
import { EllipticCurveCertificate } from './EllipticCurveCertificate';
import { ALGORITHM_HASH_MAP } from 'src/constants/key-constants';

interface GenerateKeyPairOptions {
  modulusLength?: number; // for RSA
  namedCurve?: EcCurve; // for EC
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
      const namedCurve = options.namedCurve || EcCurve.P256;
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
      const namedCurve = options.namedCurve || EcCurve.P256;
      return ecKeyUtils.generateEcJwkKeyPair(namedCurve);
    } else {
      throw new Error(`Unsupported key type: ${type}`);
    }
  }

  /**
   * Parses an X.509 certificate from PEM format and returns a human-readable text summary.
   */
  static parse(pem: string): string {
    const cert = X509Certificate.parse(pem);
    return cert.toText();
  }

  /**
   * Creates an X.509 certificate PEM from an in-memory certificate representation.
   */
  static create(certData: IX509Certificate): string {
    const { tbsCertificate, signatureAlgorithm, signatureValue } = certData;
    // Create a new certificate instance using the provided certificate data.
    const certInstance = X509Certificate.create(
      tbsCertificate,
      signatureAlgorithm,
      signatureValue,
    );

    // Use the instance's build() method to get the DER-encoded certificate.
    const derCert = certInstance.build();

    // Convert DER to Base64 and wrap with PEM headers.
    const b64Cert = derCert.toString(BinaryToTextEncoding.BASE_64);
    return wrapPem(b64Cert, 'CERTIFICATE');
  }

  /**
   * Generates a self-signed X.509 certificate.
   * Supports both RSA and EC keys based on the provided type.
   *
   * @param type - Key type ('rsa' or 'ec').
   * @param subjectName - The subject distinguished name (e.g., 'CN=example.com').
   * @param options - Additional options for key generation and certificate creation.
   * @returns An object containing the PEM-encoded certificate, public key, and private key.
   */
  static generateSelfSignedCertificate(
    type: KeyType,
    subjectName: string = 'CN=Example',
    options: GenerateKeyPairOptions = {},
  ): { certificate: string; publicKey: string; privateKey: string } {
    // Define a validity period (for demonstration, 1 year from now).
    const now = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(now.getFullYear() + 1);
    const validity: IValidity = { notBefore: now, notAfter: oneYearLater };

    if (type === 'ec') {
      const namedCurve = options.namedCurve || EcCurve.P256;
      // Generate EC key pair.
      const { publicKey, privateKey } =
        ecKeyUtils.generateEcKeyPair(namedCurve);
      // Extract public JWK information.
      const { publicJwk } = ecKeyUtils.generateEcJwkKeyPair(namedCurve);

      // Create an EC certificate using the EllipticCurveCertificate builder.
      const ecCertBuilder = new EllipticCurveCertificate(
        subjectName,
        validity,
        privateKey,
        publicJwk.crv,
        publicJwk.x,
        publicJwk.y,
      );

      const certificate = ecCertBuilder.buildCertificate();
      return { certificate, publicKey, privateKey };
    } else if (type === 'rsa') {
      const modulusLength = options.modulusLength || 2048;
      // Generate RSA key pair.
      const { publicKey, privateKey } =
        rsaKeyUtils.generateRsaKeyPair(modulusLength);
      // Extract public JWK information.
      const { publicJwk } = rsaKeyUtils.generateRsaJwkKeyPair(modulusLength);

      // Create an RSA certificate using the RsaCertificate builder.
      const rsaCertBuilder = new RsaCertificate(
        subjectName,
        validity,
        privateKey,
        publicJwk.n,
        publicJwk.e,
      );

      const certificate = rsaCertBuilder.buildCertificate();
      return { certificate, publicKey, privateKey };
    } else {
      throw new Error(`Unsupported key type: ${type}`);
    }
  }
  /**
   * Extracts the public key from a PEM-encoded X.509 certificate in JWK format.
   *
   * @param pemCertificate - PEM-encoded X.509 certificate.
   * @returns {Jwk} The public key as a JWK.
   */
  static extractPublicKeyFromCertificate(pemCertificate: string): Jwk {
    // Parse the certificate and then extract the subjectPublicKeyInfo.
    const jwk = this.pemToJwk(pemCertificate);
    return jwk;
  }

  /**
   * Verifies a signature given data, signature, and a certificate.
   *
   * @param data - The original data buffer.
   * @param signature - The signature to verify.
   * @param pemCertificate - The PEM-encoded X.509 certificate containing the public key.
   * @param Algorithm  - The hash algorithm used (e.g., 'sha256').
   * @returns {boolean} True if signature is valid, false otherwise.
   */
  static verifySignature(
    data: Buffer,
    signature: Buffer,
    pemCertificate: string,
    algorithm: Algorithm = Algorithm.SHA256,
  ): boolean {
    const { hashName } = ALGORITHM_HASH_MAP[algorithm];
    const verify = createVerify(hashName);
    verify.update(data);
    verify.end();
    return verify.verify(pemCertificate, signature);
  }
}
