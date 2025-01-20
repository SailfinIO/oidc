// Assuming these imports based on your project structure
import * as rsaKeyUtils from './rsaKeyUtils';
import * as ecKeyUtils from './ecKeyUtils';
import {
  CertificateOptions,
  IAlgorithmIdentifier,
  ITbsCertificate,
  IValidity,
  IX509Certificate,
  Jwk,
  KeyData,
} from '../interfaces';
import { X509Certificate } from './x509';
import { wrapPem } from './pem';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createVerify,
  generateKeyPairSync,
} from 'crypto';
import {
  Algorithm,
  BinaryToTextEncoding,
  CertificateLabel,
  EcCurve,
  KeyExportOptions,
  KeyFormat,
  KeyOps,
  KeyType,
} from '../enums';
import { RSACertificate } from './RSACertificate';
import { EllipticCurveCertificate } from './EllipticCurveCertificate';
import { ALGORITHM_HASH_MAP } from '../constants/key-constants';
import { generateX5c, generateX5t } from './certUtils';

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
    options: GenerateKeyPairOptions,
  ): { publicKey: string; privateKey: string } {
    if (type === KeyType.RSA) {
      const modulusLength = options.modulusLength || 2048;
      const { publicKey, privateKey } = generateKeyPairSync(KeyType.RSA, {
        modulusLength,
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
    } else if (type === KeyType.EC) {
      const namedCurve = options.namedCurve || EcCurve.P256;
      const { publicKey, privateKey } = generateKeyPairSync(KeyType.EC, {
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
    options: GenerateKeyPairOptions,
  ): { publicJwk: JsonWebKey; privateJwk: JsonWebKey } {
    // First, generate the PEM key pair using the above helper
    const { publicKey, privateKey } = this.generateKeyPair(type, options);

    // Convert PEM keys to JWK using Node.js crypto export functionality
    const publicKeyObj = createPublicKey(publicKey);
    const privateKeyObj = createPrivateKey(privateKey);
    const publicJwk: JsonWebKey = publicKeyObj.export({
      format: KeyFormat.JWK,
    });
    const privateJwk: JsonWebKey = privateKeyObj.export({
      format: KeyFormat.JWK,
    });

    return { publicJwk, privateJwk };
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
    return wrapPem(b64Cert, CertificateLabel.CERTIFICATE);
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
    options: Partial<CertificateOptions> = {},
  ): { certificate: string; publicKey: string; privateKey: string } {
    // Define default values for subject name and validity
    const now = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(now.getFullYear() + 1);
    const defaultValidity: IValidity = {
      notBefore: now,
      notAfter: oneYearLater,
    };

    const defaultSubjectName = 'CN=Example';

    // Merge defaults with provided options
    const subjectName = options.subjectName || defaultSubjectName;
    const validity = options.validity || defaultValidity;

    // Generate key pair
    const { publicKey, privateKey } = this.generateKeyPair(type, {});

    // Initialize certificate components
    let tbsCertificate: ITbsCertificate;
    let signatureAlgorithm: IAlgorithmIdentifier;

    if (type === KeyType.EC) {
      const namedCurve =
        (options.tbsCertificate?.subjectPublicKeyInfo?.algorithm.parameters?.toString() as EcCurve) ||
        EcCurve.P256;
      const { publicJwk } = this.generateJwkKeyPair(KeyType.EC, { namedCurve });

      const ecCertBuilder = new EllipticCurveCertificate(
        subjectName,
        validity,
        privateKey,
        publicJwk.crv,
        publicJwk.x,
        publicJwk.y,
      );

      const spki = ecCertBuilder.buildSubjectPublicKeyInfo();
      tbsCertificate = {
        version: options.tbsCertificate?.version || 2,
        serialNumber:
          options.tbsCertificate?.serialNumber || Buffer.from([0x01]),
        signature: options.tbsCertificate?.signature || {
          algorithm: '1.2.840.10045.4.3.2',
        }, // Default to ES256
        issuer: options.tbsCertificate?.issuer || {
          rdnSequence: [
            {
              attributes: [
                { type: '2.5.4.3', value: subjectName.replace('CN=', '') },
              ],
            },
          ],
        },
        validity: options.tbsCertificate?.validity || validity,
        subject: options.tbsCertificate?.subject || {
          rdnSequence: [
            {
              attributes: [
                { type: '2.5.4.3', value: subjectName.replace('CN=', '') },
              ],
            },
          ],
        },
        subjectPublicKeyInfo: spki,
        extensions: options.tbsCertificate?.extensions || [],
      };
      signatureAlgorithm = { algorithm: '1.2.840.10045.4.3.2' }; // Default to ES256
    } else if (type === KeyType.RSA) {
      const modulusLength = options.tbsCertificate?.subjectPublicKeyInfo
        ?.algorithm.parameters
        ? parseInt(
            options.tbsCertificate.subjectPublicKeyInfo.algorithm.parameters.toString(),
            10,
          )
        : 2048;

      const { publicJwk } = this.generateJwkKeyPair(KeyType.RSA, {
        modulusLength,
      });

      const rsaCertBuilder = new RSACertificate(
        subjectName,
        validity,
        privateKey,
        publicJwk.n,
        publicJwk.e,
      );

      const spki = rsaCertBuilder.buildSubjectPublicKeyInfo();
      tbsCertificate = {
        version: options.tbsCertificate?.version || 2,
        serialNumber:
          options.tbsCertificate?.serialNumber || Buffer.from([0x01]),
        signature: options.tbsCertificate?.signature || {
          algorithm: '1.2.840.113549.1.1.11',
        }, // Default to RS256
        issuer: options.tbsCertificate?.issuer || {
          rdnSequence: [
            {
              attributes: [
                { type: '2.5.4.3', value: subjectName.replace('CN=', '') },
              ],
            },
          ],
        },
        validity: options.tbsCertificate?.validity || validity,
        subject: options.tbsCertificate?.subject || {
          rdnSequence: [
            {
              attributes: [
                { type: '2.5.4.3', value: subjectName.replace('CN=', '') },
              ],
            },
          ],
        },
        subjectPublicKeyInfo: spki,
        extensions: options.tbsCertificate?.extensions || [],
      };
      signatureAlgorithm = { algorithm: '1.2.840.113549.1.1.11' }; // Default to RS256
    } else {
      throw new Error(`Unsupported key type: ${type}`);
    }

    // Use the `create` method to build and sign the certificate
    const certificate = this.create({
      tbsCertificate,
      signatureAlgorithm,
      signatureValue: Buffer.alloc(0), // Signature will be handled in `create`
    });

    return { certificate, publicKey, privateKey };
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

  /**
   * Creates a JWKS-compliant key representation, including x5t and x5c values.
   * @param pemCertificate - The PEM-encoded certificate.
   * @returns A JSON Web Key with x5t and x5c attributes.
   */
  static createJwksKey(pemCertificate: string): Record<string, any> {
    const x5t = generateX5t(pemCertificate);
    const x5c = generateX5c([pemCertificate]);
    return {
      x5t,
      x5c,
    };
  }

  /**
   * Generates key data, including x5c, x5t, and a key pair object, for storage or usage.
   *
   * @param privateKey - PEM-encoded private key.
   * @param publicKey - PEM-encoded public key.
   * @param certificate - PEM-encoded X.509 certificate.
   * @param alg - Algorithm used for the key (e.g., RS256).
   * @param kty - Key type (e.g., 'RSA', 'EC').
   * @param kid - Optional key identifier. If not provided, a hash of the public key will be used.
   * @param keyOps - Optional array of key operations. Defaults to ['sign', 'verify'].
   * @returns {KeyData} The generated key data including x5c, x5t, and metadata.
   */
  static generateKeyData(
    privateKey: string,
    publicKey: string,
    certificate: string,
    alg: string,
    kty: KeyType,
    kid?: string,
    keyOps: KeyOps[] = [KeyOps.SIGN, KeyOps.VERIFY], // Default key operations
  ): KeyData {
    // Compute x5c and x5t using existing helper methods
    const jwksKey = KeyUtils.createJwksKey(certificate);
    const x5c = jwksKey.x5c;
    const x5t = jwksKey.x5t;

    // Generate a unique key ID if not provided
    if (!kid) {
      const hash = createHash('sha256');
      hash.update(publicKey);
      kid = hash.digest(BinaryToTextEncoding.HEX);
    }

    // Get the current timestamp for metadata
    const createdAt = new Date();

    // Build and return the KeyData object
    return {
      privateKey,
      publicKey,
      kid,
      kty,
      alg,
      createdAt,
      activatedAt: createdAt,
      deactivatedAt: null,
      x5c,
      x5t,
      keyOps,
    };
  }
}
