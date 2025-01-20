import {
  ALGORITHM_HASH_MAP,
  RSA_PUBLIC_KEY_OID,
} from '../constants/key-constants';
import {
  ISubjectPublicKeyInfo,
  ITbsCertificate,
  IValidity,
  CertificateOptions,
} from '../interfaces';
import { Certificate } from './Certificate';
import { base64UrlDecode } from './urlUtils';
import {
  integer,
  bitString,
  sequence,
  objectIdentifier,
  derNull,
} from './derUtils';

export class RsaCertificate extends Certificate {
  private n: string;
  private e: string;

  constructor(
    subjectName: string,
    validity: IValidity,
    privateKeyPem: string,
    n: string,
    e: string,
  ) {
    super(subjectName, validity, privateKeyPem);
    this.n = n;
    this.e = e;
  }

  buildSubjectPublicKeyInfo(): ISubjectPublicKeyInfo {
    const modulus = base64UrlDecode(this.n);
    const exponent = base64UrlDecode(this.e);

    const modInt = integer(modulus);
    const expInt = integer(exponent);
    const rsaPubKeySeq = sequence(Buffer.concat([modInt, expInt]));

    const algId = sequence(
      Buffer.concat([objectIdentifier(RSA_PUBLIC_KEY_OID), derNull()]),
    );

    const rsaPubKeyBitString = bitString(rsaPubKeySeq);
    const spkiBuffer = sequence(Buffer.concat([algId, rsaPubKeyBitString]));

    // Extract the BIT STRING part from SPKI (assuming it's after the algorithm identifier)
    // This is a simplified extraction; in practice, you'd parse the DER properly.
    const bitStringTag = 0x03;
    const index = spkiBuffer.indexOf(bitStringTag);
    if (index < 0) {
      throw new Error('BIT STRING not found in SPKI buffer');
    }
    const subjectPublicKey = spkiBuffer.slice(index);

    return {
      algorithm: {
        algorithm: RSA_PUBLIC_KEY_OID,
        parameters: derNull(),
      },
      subjectPublicKey,
    };
  }

  getSignatureAlgorithm() {
    return ALGORITHM_HASH_MAP.RS256;
  }

  buildTbsCertificate(spki: ISubjectPublicKeyInfo): ITbsCertificate {
    // Simplified example: Create a basic TBS certificate for RSA.
    // In practice, fill in appropriate fields.
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
        algorithm: ALGORITHM_HASH_MAP.RS256.cryptoAlg,
        parameters: derNull(),
      },
      issuer: name,
      validity: { notBefore: now, notAfter: oneYearLater },
      subject: name,
      subjectPublicKeyInfo: spki,
    };
  }
}
