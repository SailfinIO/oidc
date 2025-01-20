import { createSign } from 'crypto';
import { CertificateOptions } from '../interfaces';
import { X509Certificate } from './x509';
import { wrapPem } from './pem';

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
  const b64Cert = derCert.toString('base64');
  return wrapPem(b64Cert, 'CERTIFICATE');
};
