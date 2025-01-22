import { RSACertificate } from './RSACertificate';
import { Algorithm } from '../enums';
import { derNull } from './derUtils';
import { ISubjectPublicKeyInfo, ITbsCertificate, IValidity } from '../interfaces';
import { ALGORITHM_DETAILS_MAP } from '../constants/algorithmConstants';
import { buildRSAPSSParams } from './certUtils';
import { base64UrlDecode } from './urlUtils';

describe('RSACertificate', () => {
  const validity: IValidity = {
    notBefore: new Date('2023-01-01T00:00:00Z'),
    notAfter: new Date('2024-01-01T00:00:00Z'),
  };
  const privateKeyPem = 'dummyPrivateKeyPem';
  const n = 'dummyModulus';
  const e = 'dummyExponent';

  let cert: RSACertificate;

  beforeEach(() => {
    cert = new RSACertificate('Test CN', validity, privateKeyPem, n, e);
  });

  test('constructor should initialize properties correctly', () => {
    expect(cert).toBeInstanceOf(RSACertificate);
    expect(cert['n']).toBe(n);
    expect(cert['e']).toBe(e);
    expect(cert['validity']).toBe(validity);
    expect(cert['privateKeyPem']).toBe(privateKeyPem);
  });

  test('buildSubjectPublicKeyInfo should build correct SPKI structure', () => {
    const spki = cert.buildSubjectPublicKeyInfo();
    expect(spki).toHaveProperty('algorithm');
    expect(spki).toHaveProperty('subjectPublicKey');
    expect(spki.algorithm).toHaveProperty('algorithm');
    expect(spki.algorithm).toHaveProperty('parameters');
  });

  test('buildTbsCertificate should build correct TBS structure', () => {
    const spki: ISubjectPublicKeyInfo = {
      algorithm: { algorithm: '1.2.840.113549.1.1.1', parameters: derNull() },
      subjectPublicKey: Buffer.from('dummyPublicKey'),
    };
    const tbs = cert.buildTbsCertificate(spki);
    expect(tbs).toHaveProperty('version');
    expect(tbs).toHaveProperty('serialNumber');
    expect(tbs).toHaveProperty('signature');
    expect(tbs).toHaveProperty('issuer');
    expect(tbs).toHaveProperty('validity');
    expect(tbs).toHaveProperty('subject');
    expect(tbs).toHaveProperty('subjectPublicKeyInfo');
  });
});
