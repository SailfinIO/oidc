import { Certificate } from './Certificate';
import {
  CertificateOptions,
  ISubjectPublicKeyInfo,
  ITbsCertificate,
  IAlgorithmIdentifier,
  IValidity,
  IName,
} from '../interfaces';
import { buildAndSignCertificate } from './certUtils';

jest.mock('./certUtils', () => ({
  buildAndSignCertificate: jest.fn(),
}));

// Concrete subclass of Certificate for testing
class TestCertificate extends Certificate {
  buildSubjectPublicKeyInfo(): ISubjectPublicKeyInfo {
    return {
      algorithm: { algorithm: '1.2.840.113549.1.1.1' },
      subjectPublicKey: Buffer.from('testPublicKey'),
    };
  }

  getSignatureAlgorithm(): { hashName: string; cryptoAlg: string } {
    return { hashName: 'SHA256', cryptoAlg: 'RSA' };
  }

  buildTbsCertificate(spki: ISubjectPublicKeyInfo): ITbsCertificate {
    return {
      serialNumber: Buffer.from([0x01]),
      signature: { algorithm: '1.2.840.113549.1.1.11' },
      issuer: {
        rdnSequence: [
          { attributes: [{ type: '2.5.4.3', value: 'TestIssuer' }] },
        ],
      },
      validity: this.validity,
      subject: {
        rdnSequence: [
          { attributes: [{ type: '2.5.4.3', value: this.subjectName }] },
        ],
      },
      subjectPublicKeyInfo: spki,
    };
  }
}

describe('Certificate', () => {
  const subjectName = 'Test Subject';
  const validity: IValidity = { notBefore: new Date(), notAfter: new Date() };
  const privateKeyPem = 'testPrivateKey';

  let testCertificate: TestCertificate;

  beforeEach(() => {
    testCertificate = new TestCertificate(subjectName, validity, privateKeyPem);
    jest.clearAllMocks();
  });

  it('should build and sign the certificate correctly', () => {
    // Arrange
    const expectedSpki: ISubjectPublicKeyInfo = {
      algorithm: { algorithm: '1.2.840.113549.1.1.1' },
      subjectPublicKey: Buffer.from('testPublicKey'),
    };
    const expectedTbsCertificate: ITbsCertificate = {
      serialNumber: Buffer.from([0x01]),
      signature: { algorithm: '1.2.840.113549.1.1.11' },
      issuer: {
        rdnSequence: [
          { attributes: [{ type: '2.5.4.3', value: 'TestIssuer' }] },
        ],
      },
      validity,
      subject: {
        rdnSequence: [
          { attributes: [{ type: '2.5.4.3', value: subjectName }] },
        ],
      },
      subjectPublicKeyInfo: expectedSpki,
    };

    const expectedOptions: CertificateOptions = {
      subjectName,
      validity,
      tbsCertificate: expectedTbsCertificate,
      signAlgorithm: { hashName: 'SHA256', cryptoAlg: 'RSA' },
      privateKeyPem,
    };

    const mockedReturnValue = 'mockedCertificateString';
    (buildAndSignCertificate as jest.Mock).mockReturnValue(mockedReturnValue);

    // Act
    const certificate = testCertificate.buildCertificate();

    // Assert
    expect(buildAndSignCertificate).toHaveBeenCalledWith(expectedOptions);
    expect(certificate).toBe(mockedReturnValue);
  });
});
