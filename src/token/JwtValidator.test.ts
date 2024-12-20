// src/token/JwtValidator.test.ts

import { JwtValidator } from './JwtValidator';
import { JwksClient } from '../clients/JwksClient';
import { ClientError } from '../errors/ClientError';
import { base64UrlEncode } from '../utils/urlUtils';
import { ILogger } from '../interfaces';

jest.mock('../clients/JwksClient');

describe('JwtValidator', () => {
  let validator: JwtValidator;
  let mockJwksClient: jest.Mocked<JwksClient>;
  let mockLogger: jest.Mocked<ILogger>;
  let discoveryConfig: any;
  let clientId: string;

  // Example RSA public key components for testing:
  // These should match a known RSA key pair if you want to test signature verification.
  // For demonstration, we won't actually perform a real signature verification here;
  // instead, we might mock the verify behavior. If you do want real signature testing,
  // generate a RSA key pair and produce a valid signed JWT.
  const dummyRsaJwk = {
    kty: 'RSA',
    n: 'sXch2AgPcEbG9PAr6Zk0JxRQac7FvS5i0WnCsGF3fZUL7qWCdtUt8OZB5uLwdTZhZKLcWQ0DlVY-YpLjiqhJQXQX0gZ_nC5Hswtn3pVPaD8Dex7fMCL8CyNfE41y5kIQoOwZyW1SpcFvU-6QyHPDxiNVhER-DWKoskcPQ_t1AcDp-hSDn1jOfzA5etxAiC_JF-Ez2O9avZUR9EvkMhbDSRJfaWm2wHEUgaw11VhkY4jNpPoAh_t3-2h1NEIowh9m0fYmE94B2AiDWj03DhdCG3r6qnXn42t6OzKJ9ut7YOLVKShK2XYIg6uvJmjkzJ3m35_S_RMWKD4gw1b76Rw',
    e: 'AQAB',
    alg: 'RS256',
    kid: 'testKeyId',
    use: 'sig',
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    discoveryConfig = {
      issuer: 'https://issuer.example.com',
      jwks_uri: 'https://issuer.example.com/jwks',
    };
    clientId = 'my-client-id';

    // Mock JwksClient
    mockJwksClient = new JwksClient(
      discoveryConfig.jwks_uri,
      mockLogger,
    ) as jest.Mocked<JwksClient>;
    (JwksClient as jest.Mock).mockReturnValue(mockJwksClient);
    mockJwksClient.getKey.mockResolvedValue(dummyRsaJwk);

    validator = new JwtValidator(mockLogger, discoveryConfig, clientId);
  });

  function encodeSegment(obj: any): string {
    return base64UrlEncode(Buffer.from(JSON.stringify(obj)));
  }

  function createJwt({
    iss,
    aud,
    exp,
    iat,
    nbf,
    nonce,
    azp,
    alg = 'RS256',
    kid = 'testKeyId',
  }: {
    iss?: string;
    aud?: string | string[];
    exp?: number;
    iat?: number;
    nbf?: number;
    nonce?: string;
    azp?: string;
    alg?: string;
    kid?: string;
  } = {}): string {
    const header = { alg, typ: 'JWT', kid };
    const payload: any = {
      iss: iss !== undefined ? iss : discoveryConfig.issuer,
      aud: aud !== undefined ? aud : clientId,
      exp: exp !== undefined ? exp : Math.floor(Date.now() / 1000) + 3600,
      iat: iat !== undefined ? iat : Math.floor(Date.now() / 1000),
    };

    if (nbf !== undefined) payload.nbf = nbf;
    if (nonce !== undefined) payload.nonce = nonce;
    if (azp !== undefined) payload.azp = azp;

    const encodedHeader = encodeSegment(header);
    const encodedPayload = encodeSegment(payload);
    // Dummy signature (not actually verified in these tests unless we mock it)
    const signature = 'dummySignature';

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  it('throws if JWT format is invalid', async () => {
    await expect(validator.validateIdToken('not-a-jwt')).rejects.toThrow(
      ClientError,
    );
  });

  it('throws if issuer is invalid', async () => {
    const jwt = createJwt({ iss: 'https://other-issuer.example.com' });
    await expect(validator.validateIdToken(jwt)).rejects.toThrow(
      'Invalid issuer',
    );
  });

  it('throws if audience is not present', async () => {
    const jwt = createJwt({ aud: 'some-other-client' });
    await expect(validator.validateIdToken(jwt)).rejects.toThrow(
      'Audience not found in ID token',
    );
  });

  it('throws if multiple audiences but azp is invalid', async () => {
    const jwt = createJwt({
      aud: ['my-client-id', 'another-audience'],
      azp: 'not-my-client-id',
    });
    await expect(validator.validateIdToken(jwt)).rejects.toThrow(
      'Invalid authorized party (azp)',
    );
  });

  it('throws if token is expired', async () => {
    const jwt = createJwt({ exp: Math.floor(Date.now() / 1000) - 10 });
    await expect(validator.validateIdToken(jwt)).rejects.toThrow(
      'ID token is expired',
    );
  });

  it('throws if iat is too far in the future', async () => {
    const now = Math.floor(Date.now() / 1000);
    // Set iat to now + 10 minutes (600 seconds), allowed is only +300
    const jwt = createJwt({ iat: now + 600 });
    await expect(validator.validateIdToken(jwt)).rejects.toThrow(
      'ID token issued-at time (iat) is too far in the future',
    );
  });

  it('throws if nbf is in the future', async () => {
    const now = Math.floor(Date.now() / 1000);
    const jwt = createJwt({ nbf: now + 1000 });
    await expect(validator.validateIdToken(jwt)).rejects.toThrow(
      'ID token not valid yet (nbf)',
    );
  });

  it('throws if nonce does not match', async () => {
    const jwt = createJwt({ nonce: 'expectedNonce' });
    await expect(validator.validateIdToken(jwt, 'otherNonce')).rejects.toThrow(
      'Invalid nonce in ID token',
    );
  });

  it('throws if signature is invalid (mock signature check)', async () => {
    // Here we will force jwksClient to return a key that doesn't match the alg
    mockJwksClient.getKey.mockResolvedValueOnce({
      ...dummyRsaJwk,
      alg: 'RS256',
    });

    // If you want to simulate a signature failure, you could mock 'crypto.verify' calls
    // or modify the token so it doesn't match a known signature.
    // For simplicity, let's simulate by throwing inside `verifySignature` method:
    const originalVerifySignature = (validator as any).verifySignature;
    (validator as any).verifySignature = jest.fn().mockImplementation(() => {
      throw new ClientError(
        'Invalid ID token signature',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    });

    const jwt = createJwt();
    await expect(validator.validateIdToken(jwt)).rejects.toThrow(
      'Invalid ID token signature',
    );

    // Restore the original method
    (validator as any).verifySignature = originalVerifySignature;
  });

  it('returns payload if validation passes', async () => {
    // Mock a successful signature verification
    const originalVerifySignature = (validator as any).verifySignature;
    (validator as any).verifySignature = jest.fn().mockResolvedValue(undefined);

    const jwt = createJwt();
    const payload = await validator.validateIdToken(jwt);
    expect(payload).toHaveProperty('iss', discoveryConfig.issuer);
    expect(payload).toHaveProperty('aud', clientId);

    // Restore
    (validator as any).verifySignature = originalVerifySignature;
  });
});
