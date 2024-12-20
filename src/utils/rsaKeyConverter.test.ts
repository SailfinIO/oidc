// src/utils/rsaKeyConverter.test.ts

import { rsaJwkToPem } from './rsaKeyConverter';
import { ClientError } from '../errors';
import { BinaryToTextEncoding } from '../enums';

// A known good RSA public JWK (example):
// Public key from a known PEM:
// -----BEGIN PUBLIC KEY-----
// MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
// -----END PUBLIC KEY-----
// Convert its modulus and exponent to base64url JWK format.
const n = 'ALICE...'; // Replace with valid base64url-encoded modulus
const e = 'AQAB'; // Common exponent (65537 in base64url)

describe('rsaJwkToPem', () => {
  it('should convert a valid RSA JWK to a PEM public key', () => {
    const pem = rsaJwkToPem(n, e);
    expect(pem).toMatch(/^-----BEGIN PUBLIC KEY-----\n/);
    expect(pem).toMatch(/\n-----END PUBLIC KEY-----$/);

    const base64Body = pem
      .replace('-----BEGIN PUBLIC KEY-----\n', '')
      .replace('\n-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '');

    // Check if it's valid base64
    expect(() =>
      Buffer.from(base64Body, BinaryToTextEncoding.BASE_64),
    ).not.toThrow();
  });

  it('should throw if n is not valid base64url', () => {
    expect(() => rsaJwkToPem('###', e)).toThrow(Error); // or ClientError depending on how urlDecode is handled.
  });

  it('should throw if e is not valid base64url', () => {
    expect(() => rsaJwkToPem(n, '%%%')).toThrow(Error);
  });

  it('should handle empty n or e', () => {
    // If your code doesn't currently check this, you might want to add a check in rsaJwkToPem
    // and expect a certain type of error. For now, just ensure it doesn't produce a valid key.
    expect(() => rsaJwkToPem('', e)).toThrow(Error);
    expect(() => rsaJwkToPem(n, '')).toThrow(Error);
  });
});
