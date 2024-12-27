// src/utils/derEncoding.test.ts

import {
  SEQUENCE,
  INTEGER,
  BIT_STRING,
  NULL_TAG,
  OBJECT_IDENTIFIER,
  encodeLength,
  encodeDER,
  derNull,
  integer,
  bitString,
  sequence,
  objectIdentifier,
  ecDsaSignatureFromRaw,
} from './derEncoding';
import { ClientError } from '../errors/ClientError';
import { Algorithm } from '../enums';

describe('DER Encoding Utilities', () => {
  describe('encodeLength', () => {
    it('should encode a length less than 128 as a single byte', () => {
      const buf = encodeLength(127);
      expect(buf).toEqual(Buffer.from([0x7f]));
    });

    it('should encode a length of 128 or more in multiple bytes', () => {
      const buf = encodeLength(300);
      // 300 decimal = 0x012C hex
      // length should be: 0x82 (indicates two bytes), 0x01, 0x2C
      expect(buf).toEqual(Buffer.from([0x82, 0x01, 0x2c]));
    });

    it('should throw a RangeError if the length is negative', () => {
      expect(() => encodeLength(-1)).toThrow(RangeError);
      expect(() => encodeLength(-1)).toThrow('Length cannot be negative');
    });

    it('should handle very large lengths correctly', () => {
      const largeLength = 65535; // 0xFFFF
      const buf = encodeLength(largeLength);
      // This would be length: 0x83 (3 bytes), 0xFF, 0xFF
      expect(buf).toEqual(Buffer.from([0x82, 0xff, 0xff]));
    });
  });

  describe('encodeDER', () => {
    it('should encode a given tag and content using DER', () => {
      const content = Buffer.from([0x01, 0x02, 0x03]);
      const tag = 0x30; // SEQUENCE
      const encoded = encodeDER(tag, content);
      // Expect:
      // [0x30, length=3, content...]
      expect(encoded).toEqual(Buffer.from([0x30, 0x03, 0x01, 0x02, 0x03]));
    });
  });

  describe('derNull', () => {
    it('should return a DER-encoded NULL value', () => {
      const val = derNull();
      expect(val).toEqual(Buffer.from([NULL_TAG, 0x00]));
    });
  });

  describe('integer', () => {
    it('should encode a small positive integer', () => {
      const val = Buffer.from([0x01]);
      const encoded = integer(val);
      // Expect INTEGER tag (0x02), length=1, and the value [0x01]
      expect(encoded).toEqual(Buffer.from([INTEGER, 0x01, 0x01]));
    });

    it('should add a 0x00 byte if the highest bit is set', () => {
      // 0x80 (128) has the highest bit set, requiring a 0x00 prefix
      const val = Buffer.from([0x80]);
      const encoded = integer(val);
      // Expect INTEGER tag, length=2, [0x00, 0x80]
      expect(encoded).toEqual(Buffer.from([INTEGER, 0x02, 0x00, 0x80]));
    });
  });

  describe('bitString', () => {
    it('should encode a BIT STRING with a leading 0x00', () => {
      const val = Buffer.from([0xff, 0xaa]);
      const encoded = bitString(val);
      // Expect BIT_STRING tag, length=3, [0x00, 0xFF, 0xAA]
      expect(encoded).toEqual(
        Buffer.from([BIT_STRING, 0x03, 0x00, 0xff, 0xaa]),
      );
    });
  });

  describe('sequence', () => {
    it('should encode a SEQUENCE of given contents', () => {
      const contents = Buffer.from([0x01, 0x02]);
      const encoded = sequence(contents);
      // Expect SEQUENCE tag, length=2, [0x01, 0x02]
      expect(encoded).toEqual(Buffer.from([SEQUENCE, 0x02, 0x01, 0x02]));
    });
  });

  describe('objectIdentifier', () => {
    it('should encode a valid OID', () => {
      // OID example: 1.2.840.10045.2.1
      // First byte = 40 * 1 + 2 = 42 (0x2A)
      // Remaining: 840 = 0x348, 10045 = ...
      // We'll trust the encoding function and just test output.
      const oid = '1.2.840.10045.2.1';
      const encoded = objectIdentifier(oid);
      // Just check for correct tags and structure
      expect(encoded[0]).toBe(OBJECT_IDENTIFIER);
      // The length byte should not be 0, and we have a known OID value:
      // Let's decode a known encoding using an external reference:
      // OID: 1.2.840.10045.2.1 -> DER: 06 08 2A 86 48 CE 3D 02 01
      const expected = Buffer.from([
        OBJECT_IDENTIFIER,
        0x07,
        0x2a,
        0x86,
        0x48,
        0xce,
        0x3d,
        0x02,
        0x01,
      ]);
      expect(encoded).toEqual(expected);
    });

    it('should throw an error for invalid OID', () => {
      // Must have at least two parts
      expect(() => objectIdentifier('1')).toThrow(ClientError);
    });
  });

  describe('ecDsaSignatureFromRaw', () => {
    it('should convert a raw ECDSA signature (ES256) to DER', () => {
      // For ES256, key length is 32 bytes for R and 32 bytes for S
      const r = Buffer.alloc(32, 0x01); // 32 bytes of 0x01
      const s = Buffer.alloc(32, 0x02); // 32 bytes of 0x02
      const rawSig = Buffer.concat([r, s]);

      const derSig = ecDsaSignatureFromRaw(rawSig, Algorithm.ES256);
      // We won't decode fully here, but we can check tags and lengths.
      // DER structure: SEQUENCE { INTEGER(R) INTEGER(S) }
      expect(derSig[0]).toBe(SEQUENCE);

      // Since R and S are padded if needed, let's just check that the signature is long enough.
      expect(derSig.length).toBeGreaterThan(64);
    });

    it('should throw error if the raw signature length is invalid for ES256', () => {
      const rawSig = Buffer.alloc(63, 0x00); // Not the correct length (should be 64)
      expect(() => ecDsaSignatureFromRaw(rawSig, Algorithm.ES256)).toThrow(
        ClientError,
      );
    });

    it('should throw an error for unsupported algorithms', () => {
      const rawSig = Buffer.alloc(64, 0x00); // 64 bytes of zero
      expect(() => ecDsaSignatureFromRaw(rawSig, Algorithm.RS256)).toThrow(
        ClientError,
      );
    });

    it('should convert a raw ECDSA signature (ES384) to DER', () => {
      // For ES384, key length is 48 bytes
      const r = Buffer.alloc(48, 0x01); // 48 bytes of 0x01
      const s = Buffer.alloc(48, 0x02); // 48 bytes of 0x02
      const rawSig = Buffer.concat([r, s]);

      const derSig = ecDsaSignatureFromRaw(rawSig, Algorithm.ES384);
      expect(derSig[0]).toBe(SEQUENCE);
      // Check length at least:
      expect(derSig.length).toBeGreaterThan(96);
    });

    it('should throw an error if the raw signature length is invalid for ES384', () => {
      const rawSig = Buffer.alloc(95, 0x00); // Should be 96, but we have 95
      expect(() => ecDsaSignatureFromRaw(rawSig, Algorithm.ES384)).toThrow(
        ClientError,
      );
    });

    it('should convert a raw ECDSA signature (ES512) to DER', () => {
      // For ES512, key length is 66 bytes
      const r = Buffer.alloc(66, 0x01); // 66 bytes of 0x01
      const s = Buffer.alloc(66, 0x02); // 66 bytes of 0x02
      const rawSig = Buffer.concat([r, s]);

      const derSig = ecDsaSignatureFromRaw(rawSig, Algorithm.ES512);
      expect(derSig[0]).toBe(SEQUENCE);
      // Check length at least:
      expect(derSig.length).toBeGreaterThan(132);
    });

    it('should throw an error if the raw signature length is invalid for ES512', () => {
      const rawSig = Buffer.alloc(131, 0x00); // Should be 132, but we have 131
      expect(() => ecDsaSignatureFromRaw(rawSig, Algorithm.ES512)).toThrow(
        ClientError,
      );
    });
  });
});
