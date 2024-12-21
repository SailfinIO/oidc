// src/utils/SignatureVerifier.test.ts

import { constants, verify as cryptoVerify } from 'crypto';
import { SignatureVerifier } from './SignatureVerifier';
import { ClientError } from '../errors/ClientError';
import { JwksClient } from '../clients';
import { ecDsaSignatureFromRaw } from './derEncoding';
import { ecJwkToPem } from './ecKeyConverter';
import { rsaJwkToPem } from './rsaKeyConverter';
import { Algorithm } from '../enums';
import { IDiscoveryConfig, ILogger } from '../interfaces';
import { base64UrlDecode } from './urlUtils';

// Correctly mock individual modules
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  verify: jest.fn(),
}));

jest.mock('../clients/JwksClient'); // Assuming JwksClient is a class

jest.mock('./rsaKeyConverter', () => ({
  rsaJwkToPem: jest.fn(),
}));

jest.mock('./ecKeyConverter', () => ({
  ecJwkToPem: jest.fn(),
}));

jest.mock('./derEncoding', () => ({
  ecDsaSignatureFromRaw: jest.fn(),
}));

jest.mock('./urlUtils', () => ({
  base64UrlDecode: jest.fn((input: string) => Buffer.from(input)),
}));

describe('SignatureVerifier', () => {
  let jwksClientMock: jest.Mocked<JwksClient>;
  let discoveryConfig: IDiscoveryConfig;
  let mockLogger: jest.Mocked<ILogger>;
  let verifier: SignatureVerifier;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    discoveryConfig = {
      issuer: 'https://auth.example.com',
      jwks_uri: 'https://auth.example.com/.well-known/jwks.json',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      userinfo_endpoint: 'https://auth.example.com/userinfo',
    };

    // Instantiate the mocked JwksClient
    jwksClientMock = new JwksClient(
      discoveryConfig.jwks_uri,
      mockLogger,
    ) as jest.Mocked<JwksClient>;

    verifier = new SignatureVerifier(jwksClientMock);

    // Set up return values for mocked functions
    (ecJwkToPem as jest.Mock).mockReturnValue('mockEcPem');
    (rsaJwkToPem as jest.Mock).mockReturnValue('mockRsaPem');
    (ecDsaSignatureFromRaw as jest.Mock).mockReturnValue(
      Buffer.from('mockDerSignature'),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validHeader = { kid: 'validKid', alg: Algorithm.RS256 };
  const validRsaJwk = {
    kty: 'RSA',
    n: 'some-n',
    e: 'some-e',
    alg: 'RS256',
  };

  const validEcJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: 'some-x',
    y: 'some-y',
    alg: 'ES256',
  };

  const validIdToken = 'header.payload.signature'; // mocks a correct 3-segment token
  const validSigningInput = 'header.payload';

  describe('Happy Paths', () => {
    it('should verify a valid RSA token', async () => {
      jwksClientMock.getKey.mockResolvedValue(validRsaJwk);
      (cryptoVerify as jest.Mock).mockReturnValue(true);

      await expect(
        verifier.verify(validHeader, validIdToken),
      ).resolves.toBeUndefined();

      expect(jwksClientMock.getKey).toHaveBeenCalledWith('validKid');
      expect(rsaJwkToPem).toHaveBeenCalledWith('some-n', 'some-e');
      expect(cryptoVerify).toHaveBeenCalledWith(
        'sha256',
        Buffer.from(validSigningInput),
        expect.objectContaining({ key: 'mockRsaPem' }),
        Buffer.from('signature'), // base64UrlDecode returns Buffer.from('signature')
      );
    });

    it('should verify a valid EC token', async () => {
      const ecHeader = { kid: 'validKid', alg: 'ES256' as Algorithm };
      jwksClientMock.getKey.mockResolvedValue(validEcJwk);
      (cryptoVerify as jest.Mock).mockReturnValue(true);

      await expect(
        verifier.verify(ecHeader, validIdToken),
      ).resolves.toBeUndefined();

      expect(jwksClientMock.getKey).toHaveBeenCalledWith('validKid');
      expect(ecJwkToPem).toHaveBeenCalledWith('P-256', 'some-x', 'some-y');
      expect(ecDsaSignatureFromRaw).toHaveBeenCalledWith(
        Buffer.from('signature'),
        'ES256',
      );
      expect(cryptoVerify).toHaveBeenCalledWith(
        'sha256',
        Buffer.from(validSigningInput),
        { key: 'mockEcPem', dsaEncoding: 'der' },
        Buffer.from('mockDerSignature'),
      );
    });
  });

  describe('Error Conditions', () => {
    it('should throw if kid is missing', async () => {
      const headerWithoutKid = { alg: 'RS256' as Algorithm };
      await expect(
        verifier.verify(headerWithoutKid as any, validIdToken),
      ).rejects.toThrow(
        new ClientError(
          'Missing kid or alg in header',
          'ID_TOKEN_VALIDATION_ERROR',
        ),
      );
    });

    it('should throw if alg is missing', async () => {
      const headerWithoutAlg = { kid: 'someKid' };
      await expect(
        verifier.verify(headerWithoutAlg as any, validIdToken),
      ).rejects.toThrow(
        new ClientError(
          'Missing kid or alg in header',
          'ID_TOKEN_VALIDATION_ERROR',
        ),
      );
    });

    it('should throw if token format is invalid (not 3 parts)', async () => {
      jwksClientMock.getKey.mockResolvedValue(validRsaJwk);
      await expect(
        verifier.verify(validHeader, 'invalid.token'),
      ).rejects.toThrow(
        new ClientError('Invalid JWT format', 'ID_TOKEN_VALIDATION_ERROR'),
      );
    });

    it('should throw on invalid base64 encoding in signature', async () => {
      // Mock base64UrlDecode to throw an error for invalid input
      (base64UrlDecode as jest.Mock).mockImplementation((input: string) => {
        if (input === '@@@') {
          throw new Error('Input contains invalid Base64URL characters');
        }
        return Buffer.from(input);
      });

      jwksClientMock.getKey.mockResolvedValue(validRsaJwk);
      await expect(
        verifier.verify(validHeader, 'header.payload.@@@'),
      ).rejects.toThrow(
        new ClientError(
          'Input contains invalid Base64URL characters',
          'ID_TOKEN_VALIDATION_ERROR',
        ),
      );
    });

    it('should throw if unsupported algorithm is given', async () => {
      const unsupportedHeader = { kid: 'validKid', alg: 'XYZ256' as Algorithm };
      jwksClientMock.getKey.mockResolvedValue({ kty: 'RSA' } as any);
      await expect(
        verifier.verify(unsupportedHeader, validIdToken),
      ).rejects.toThrow(
        new ClientError(
          'Unsupported algorithm: XYZ256',
          'ID_TOKEN_VALIDATION_ERROR',
        ),
      );
    });

    it('should throw if JWK kty does not match algorithm type', async () => {
      // alg RS256 expects RSA key but we give EC
      jwksClientMock.getKey.mockResolvedValue(validEcJwk);
      await expect(verifier.verify(validHeader, validIdToken)).rejects.toThrow(
        new ClientError(
          'JWK kty mismatch. Expected RSA for alg RS256',
          'ID_TOKEN_VALIDATION_ERROR',
        ),
      );
    });

    it('should throw if EC curve is incorrect for ES256', async () => {
      const incorrectCurveJwk = { ...validEcJwk, crv: 'P-384' };
      const ecHeader = { kid: 'validKid', alg: 'ES256' as Algorithm };
      jwksClientMock.getKey.mockResolvedValue(incorrectCurveJwk);
      await expect(verifier.verify(ecHeader, validIdToken)).rejects.toThrow(
        new ClientError(
          'Incorrect curve for ES256',
          'ID_TOKEN_VALIDATION_ERROR',
        ),
      );
    });

    it('should throw if signature verification fails for RSA', async () => {
      jwksClientMock.getKey.mockResolvedValue(validRsaJwk);
      (cryptoVerify as jest.Mock).mockReturnValue(false);

      await expect(verifier.verify(validHeader, validIdToken)).rejects.toThrow(
        new ClientError(
          'Invalid ID token signature',
          'ID_TOKEN_VALIDATION_ERROR',
        ),
      );
    });

    it('should throw if key type is unsupported', async () => {
      jwksClientMock.getKey.mockResolvedValue({
        kty: 'foo',
        alg: 'RS256',
      } as any);
      await expect(verifier.verify(validHeader, validIdToken)).rejects.toThrow(
        new ClientError(
          'JWK kty mismatch. Expected RSA for alg RS256',
          'ID_TOKEN_VALIDATION_ERROR',
        ),
      );
    });
  });

  describe('Branch Coverage', () => {
    it('should handle PS algorithms (RSA-PSS)', async () => {
      const psHeader = { kid: 'validKid', alg: 'PS256' as Algorithm };
      const psJwk = { ...validRsaJwk, alg: 'PS256' };
      jwksClientMock.getKey.mockResolvedValue(psJwk);
      (cryptoVerify as jest.Mock).mockReturnValue(true);

      await expect(
        verifier.verify(psHeader, validIdToken),
      ).resolves.toBeUndefined();
      expect(cryptoVerify).toHaveBeenCalledWith(
        'sha256',
        Buffer.from(validSigningInput),
        expect.objectContaining({ padding: constants.RSA_PKCS1_PSS_PADDING }),
        Buffer.from('signature'),
      );
    });

    it('should throw if HS algorithm is used (unsupported in current implementation)', async () => {
      const hsHeader = { kid: 'validKid', alg: 'HS256' as Algorithm };
      // For HS256, we expect 'oct' key type
      jwksClientMock.getKey.mockResolvedValue({
        kty: 'oct',
        alg: 'HS256',
      } as any);

      await expect(verifier.verify(hsHeader, validIdToken)).rejects.toThrow(
        new ClientError(
          'Unsupported key type: oct',
          'ID_TOKEN_VALIDATION_ERROR',
        ),
      );
    });
  });
});
