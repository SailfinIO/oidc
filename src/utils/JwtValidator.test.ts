// src/utils/JwtValidator.test.ts

// 1. Move jest.mock calls to the top before any imports
jest.mock('./ClaimsValidator');
jest.mock('./SignatureVerifier');
jest.mock('../clients/JwksClient');
jest.mock('./urlUtils');

import { JwtValidator } from './JwtValidator';
import { ClientError } from '../errors/ClientError';
import { ClaimsValidator } from './ClaimsValidator';
import { SignatureVerifier } from './SignatureVerifier';
import { JwksClient } from '../clients';
import { ILogger, IDiscoveryConfig } from '../interfaces';
import { base64UrlDecode } from './urlUtils';

describe('JwtValidator', () => {
  let mockLogger: jest.Mocked<ILogger>;
  let discoveryConfig: IDiscoveryConfig;
  let clientId: string;

  let claimsValidatorMock: jest.Mocked<ClaimsValidator>;
  let signatureVerifierMock: jest.Mocked<SignatureVerifier>;
  let jwksClientMock: jest.Mocked<JwksClient>;

  beforeEach(() => {
    // Initialize the mock logger with jest.fn() for each method
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

    clientId = 'client-app';

    // Create mocked instances
    claimsValidatorMock = new ClaimsValidator(
      discoveryConfig.issuer,
      clientId,
    ) as jest.Mocked<ClaimsValidator>;
    claimsValidatorMock.validate = jest.fn();

    signatureVerifierMock = new SignatureVerifier(
      {} as JwksClient,
    ) as jest.Mocked<SignatureVerifier>;
    signatureVerifierMock.verify = jest.fn().mockResolvedValue(undefined);

    jwksClientMock = new JwksClient(
      discoveryConfig.jwks_uri,
      mockLogger,
    ) as jest.Mocked<JwksClient>;

    // Reset all mocks before each test
    jest.resetAllMocks();

    // Configure the mocked classes to return the mocked instances
    (ClaimsValidator as jest.Mock).mockReturnValue(claimsValidatorMock);
    (SignatureVerifier as jest.Mock).mockReturnValue(signatureVerifierMock);
    (JwksClient as jest.Mock).mockReturnValue(jwksClientMock);

    // Mock base64UrlDecode to return specific buffers based on input
    (base64UrlDecode as jest.Mock).mockImplementation((input: string) => {
      if (input === 'validHeader') {
        return Buffer.from(
          JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
          'utf-8',
        );
      } else if (input === 'validPayload') {
        return Buffer.from(
          JSON.stringify({
            iss: discoveryConfig.issuer,
            sub: 'user123',
            aud: clientId,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
          'utf-8',
        );
      } else if (input === 'invalidJSON') {
        return Buffer.from('{invalidJson:', 'utf-8');
      } else {
        // Default to empty buffer
        return Buffer.from('');
      }
    });
  });

  it('constructs with default jwksClient, claimsValidator, and signatureVerifier if not provided', () => {
    const validator = new JwtValidator(mockLogger, discoveryConfig, clientId);
    expect(validator).toBeDefined();
    expect(JwksClient).toHaveBeenCalledWith(
      discoveryConfig.jwks_uri,
      mockLogger,
    );
    expect(ClaimsValidator).toHaveBeenCalledWith(
      discoveryConfig.issuer,
      clientId,
    );
    expect(SignatureVerifier).toHaveBeenCalledWith(jwksClientMock);
  });

  it('constructs with provided jwksClient, claimsValidator, and signatureVerifier', () => {
    // Create custom instances (these will actually be mocked instances)
    const customJwks = new JwksClient(discoveryConfig.jwks_uri, mockLogger);
    const customClaimsValidator = new ClaimsValidator(
      discoveryConfig.issuer,
      clientId,
    );
    const customSignatureVerifier = new SignatureVerifier(customJwks);

    const validator = new JwtValidator(
      mockLogger,
      discoveryConfig,
      clientId,
      customJwks,
      customClaimsValidator,
      customSignatureVerifier,
    );

    expect(validator).toBeDefined();
    // The JwtValidator should not have called the constructors again since custom instances are provided
    // However, due to jest.mock, the constructors were called when creating custom instances
    // So expect the total number of constructor calls to be 3 (one each for custom instances)
    expect(JwksClient).toHaveBeenCalledTimes(1); // customJwks
    expect(ClaimsValidator).toHaveBeenCalledTimes(1); // customClaimsValidator
    expect(SignatureVerifier).toHaveBeenCalledTimes(1); // customSignatureVerifier
    // JwtValidator constructor should not have called them again
    // So no additional calls
  });

  describe('validateIdToken', () => {
    const validHeaderPart = 'validHeader';
    const validPayloadPart = 'validPayload';
    const validSignaturePart = 'validSignature';
    const validIdToken = [
      validHeaderPart,
      validPayloadPart,
      validSignaturePart,
    ].join('.');

    it('validates a valid token successfully', async () => {
      const validator = new JwtValidator(mockLogger, discoveryConfig, clientId);
      const payload = await expect(
        validator.validateIdToken(validIdToken, 'nonce'),
      ).resolves.toEqual({
        iss: discoveryConfig.issuer,
        sub: 'user123',
        aud: clientId,
        exp: expect.any(Number),
      });

      // Check that logger.debug was called with starting message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting ID token validation process',
      );

      // Check that decodeJwt was called correctly via mock base64UrlDecode
      expect(base64UrlDecode).toHaveBeenCalledWith(validHeaderPart);
      expect(base64UrlDecode).toHaveBeenCalledWith(validPayloadPart);

      // Check that claimsValidator.validate was called with the decoded payload and nonce
      expect(claimsValidatorMock.validate).toHaveBeenCalledWith(
        {
          iss: discoveryConfig.issuer,
          sub: 'user123',
          aud: clientId,
          exp: expect.any(Number),
        },
        'nonce',
      );

      // Check that signatureVerifier.verify was called with decoded header and idToken
      expect(signatureVerifierMock.verify).toHaveBeenCalledWith(
        { alg: 'RS256', typ: 'JWT' },
        validIdToken,
      );

      // Check additional logger.debug calls
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JWT successfully decoded',
        {
          header: { alg: 'RS256', typ: 'JWT' },
          payload: {
            iss: discoveryConfig.issuer,
            sub: 'user123',
            aud: clientId,
            exp: expect.any(Number),
          },
        },
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Claims validated successfully',
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Signature verified successfully',
      );
    });

    it('throws error if JWT format is invalid (not 3 parts)', async () => {
      const invalidIdToken = 'invalid.token';
      const validator = new JwtValidator(mockLogger, discoveryConfig, clientId);

      await expect(validator.validateIdToken(invalidIdToken)).rejects.toThrow(
        ClientError,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid JWT format, expected 3 parts',
      );
    });

    it('throws error if header or payload is invalid JSON', async () => {
      const invalidJSONIdToken = [
        'invalidJSON',
        'invalidJSON',
        'signature',
      ].join('.');
      (base64UrlDecode as jest.Mock).mockImplementation((input: string) => {
        return input === 'invalidJSON'
          ? Buffer.from('{invalidJson:', 'utf-8')
          : Buffer.from('');
      });

      const validator = new JwtValidator(mockLogger, discoveryConfig, clientId);

      await expect(
        validator.validateIdToken(invalidJSONIdToken),
      ).rejects.toThrow(ClientError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid JWT format during decode',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('throws error if ClaimsValidator throws an error', async () => {
      claimsValidatorMock.validate.mockImplementation(() => {
        throw new ClientError(
          'Claim validation failed',
          'ID_TOKEN_VALIDATION_ERROR',
        );
      });

      const validator = new JwtValidator(mockLogger, discoveryConfig, clientId);

      await expect(validator.validateIdToken(validIdToken)).rejects.toThrow(
        'Claim validation failed',
      );

      expect(claimsValidatorMock.validate).toHaveBeenCalledWith(
        {
          iss: discoveryConfig.issuer,
          sub: 'user123',
          aud: clientId,
          exp: expect.any(Number),
        },
        undefined, // no nonce
      );

      // Check logger calls
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting ID token validation process',
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JWT successfully decoded',
        {
          header: { alg: 'RS256', typ: 'JWT' },
          payload: {
            iss: discoveryConfig.issuer,
            sub: 'user123',
            aud: clientId,
            exp: expect.any(Number),
          },
        },
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Claims validation failed',
        { error: expect.any(ClientError) },
      );
    });

    it('throws error if SignatureVerifier throws an error', async () => {
      signatureVerifierMock.verify.mockImplementation(() => {
        throw new ClientError(
          'Signature verification failed',
          'ID_TOKEN_VALIDATION_ERROR',
        );
      });

      const validator = new JwtValidator(mockLogger, discoveryConfig, clientId);

      await expect(validator.validateIdToken(validIdToken)).rejects.toThrow(
        'Signature verification failed',
      );

      expect(signatureVerifierMock.verify).toHaveBeenCalledWith(
        { alg: 'RS256', typ: 'JWT' },
        validIdToken,
      );

      // Check logger calls
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting ID token validation process',
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JWT successfully decoded',
        {
          header: { alg: 'RS256', typ: 'JWT' },
          payload: {
            iss: discoveryConfig.issuer,
            sub: 'user123',
            aud: clientId,
            exp: expect.any(Number),
          },
        },
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Claims validated successfully',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Signature verification failed',
        { error: expect.any(ClientError) },
      );
    });

    it('returns payload if everything is valid', async () => {
      const validator = new JwtValidator(mockLogger, discoveryConfig, clientId);
      const payload = await validator.validateIdToken(validIdToken, 'nonce');
      expect(payload.iss).toBe(discoveryConfig.issuer);
      expect(payload.aud).toBe(clientId);
      expect(payload.sub).toBe('user123');
      expect(payload.exp).toBeDefined();
    });
  });
});
