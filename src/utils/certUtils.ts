import { createHash, createSign } from 'crypto';
import { CertificateOptions } from '../interfaces';
import { X509Certificate } from './x509';
import { pemToDer, wrapPem } from './pem';
import { BinaryToTextEncoding, CertificateLabel } from '../enums';

export const buildAndSignCertificate = (
  options: CertificateOptions,
): string => {
  const { tbsCertificate, signAlgorithm, privateKeyPem } = options;
  // Build TBS certificate DER
  const tbsDer = X509Certificate.buildTbsCertificate(tbsCertificate);

  // Sign TBSCertificate
  const signatureValue = (() => {
    const sign = createSign(signAlgorithm.hashName);
    sign.update(tbsDer);
    sign.end();
    return sign.sign(privateKeyPem);
  })();

  // Create final certificate
  const certInstance = X509Certificate.create(
    tbsCertificate,
    tbsCertificate.signature,
    signatureValue,
  );

  // Build DER-encoded certificate
  const derCert = certInstance.build();

  // Convert DER to PEM format
  const b64Cert = derCert.toString(BinaryToTextEncoding.BASE_64);
  return wrapPem(b64Cert, CertificateLabel.CERTIFICATE);
};

/**
 * Generates the x5t (X.509 Certificate Thumbprint) for JWKS usage.
 * @param pemCertificate - The PEM-encoded certificate.
 * @returns The x5t value as a Base64URL-encoded string.
 */
export const generateX5t = (pemCertificate: string): string => {
  const derCertificate = pemToDer(pemCertificate); // Convert PEM to DER
  const hash = createHash('sha1').update(derCertificate).digest(); // SHA-1 hash
  return hash.toString(BinaryToTextEncoding.BASE_64_URL); // Base64URL-encode
};

/**
 * Generates the x5c (X.509 Certificate Chain) for JWKS usage.
 * @param pemCertificates - An array of PEM-encoded certificates, ordered from leaf to root.
 * @returns The x5c value as an array of Base64-encoded strings.
 */
export const generateX5c = (pemCertificates: string[]): string[] => {
  return pemCertificates.map((pem) => {
    const derCertificate = pemToDer(pem); // Convert PEM to DER
    return derCertificate.toString(BinaryToTextEncoding.BASE_64); // Base64-encode
  });
};
