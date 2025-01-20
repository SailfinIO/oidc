import {
  ALGORITHM_HASH_MAP,
  CURVE_OIDS,
  EC_PUBLIC_KEY_OID,
} from '../constants/key-constants';
import {
  ISubjectPublicKeyInfo,
  ITbsCertificate,
  IValidity,
} from '../interfaces';
import { Certificate } from './Certificate';
import { derNull, objectIdentifier } from './derUtils';
import { ecJwkToSpki } from './ecKeyUtils';

export class EllipticCurveCertificate extends Certificate {
  private crv: string;
  private x: string;
  private y: string;

  constructor(
    subjectName: string,
    validity: IValidity,
    privateKeyPem: string,
    crv: string,
    x: string,
    y: string,
  ) {
    super(subjectName, validity, privateKeyPem);
    this.crv = crv;
    this.x = x;
    this.y = y;
  }

  buildSubjectPublicKeyInfo(): ISubjectPublicKeyInfo {
    const spkiBuffer = ecJwkToSpki(this.crv, this.x, this.y);
    // Extract BIT STRING part from spkiBuffer
    const bitStringTag = 0x03;
    const index = spkiBuffer.indexOf(bitStringTag);
    if (index < 0) {
      throw new Error('BIT STRING not found in SPKI buffer');
    }
    const subjectPublicKey = spkiBuffer.subarray(index);

    return {
      algorithm: {
        algorithm: EC_PUBLIC_KEY_OID,
        parameters: objectIdentifier(CURVE_OIDS[this.crv]),
      },
      subjectPublicKey,
    };
  }

  getSignatureAlgorithm() {
    return ALGORITHM_HASH_MAP.ES256; // Adjust based on curve if necessary
  }

  buildTbsCertificate(spki: ISubjectPublicKeyInfo): ITbsCertificate {
    // Simplified example: Create a basic TBS certificate for EC.
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(now.getFullYear() + 1);

    const name = {
      rdnSequence: [
        {
          attributes: [
            { type: '2.5.4.3', value: this.subjectName.replace('CN=', '') },
          ],
        },
      ],
    };

    return {
      version: 2,
      serialNumber: Buffer.from([0x01]),
      signature: {
        algorithm: ALGORITHM_HASH_MAP.ES256.cryptoAlg,
        parameters: derNull(),
      },
      issuer: name,
      validity: { notBefore: now, notAfter: oneYearLater },
      subject: name,
      subjectPublicKeyInfo: spki,
    };
  }
}
