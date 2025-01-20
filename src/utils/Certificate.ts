import {
  CertificateOptions,
  ISubjectPublicKeyInfo,
  ITbsCertificate,
  IValidity,
} from '../interfaces';
import { buildAndSignCertificate } from './certUtils';

export abstract class Certificate {
  protected subjectName: string;
  protected validity: IValidity;
  protected privateKeyPem: string;

  constructor(subjectName: string, validity: IValidity, privateKeyPem: string) {
    this.subjectName = subjectName;
    this.validity = validity;
    this.privateKeyPem = privateKeyPem;
  }

  abstract buildSubjectPublicKeyInfo(): ISubjectPublicKeyInfo;
  abstract getSignatureAlgorithm(): { hashName: string; cryptoAlg: string };
  abstract buildTbsCertificate(spki: ISubjectPublicKeyInfo): ITbsCertificate;

  buildCertificate(): string {
    const spki = this.buildSubjectPublicKeyInfo();
    const signatureAlg = this.getSignatureAlgorithm();
    const tbsCertificate = this.buildTbsCertificate(spki);
    const options: CertificateOptions = {
      subjectName: this.subjectName,
      validity: this.validity,
      tbsCertificate,
      signAlgorithm: signatureAlg,
      privateKeyPem: this.privateKeyPem,
    };
    return buildAndSignCertificate(options);
  }
}
