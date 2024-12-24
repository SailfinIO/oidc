// src/clients/Auth.test.ts

jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  sleep: jest.fn(), // Mock the sleep function
}));

import { Auth } from './Auth';
import { Token } from './Token';
import {
  IIssuer,
  ClientMetadata,
  IClientConfig,
  ILogger,
  IHttp,
  IToken,
  IAuth,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { buildLogoutUrl, sleep } from '../utils';
import { PkceMethod, Scopes, GrantType } from '../enums';

describe('Auth', () => {
  let mockIssuer: jest.Mocked<IIssuer>;
  let mockHttpClient: jest.Mocked<IHttp>;
  let mockLogger: jest.Mocked<ILogger>;
  let mockTokenClient: jest.Mocked<IToken>;
  let auth: IAuth;
  let config: IClientConfig;

  const mockClientMetadata: Partial<ClientMetadata> = {
    issuer: 'https://example.com/',
    authorization_endpoint: 'https://example.com/oauth2/authorize',
    token_endpoint: 'https://example.com/oauth2/token',
    end_session_endpoint: 'https://example.com/oauth2/logout',
    jwks_uri: 'https://example.com/.well-known/jwks.json',
    userinfo_endpoint: 'https://example.com/oauth2/userinfo',
    device_authorization_endpoint:
      'https://example.com/oauth2/device_authorize',
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };

    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      options: jest.fn(),
      head: jest.fn(),
      connect: jest.fn(),
      trace: jest.fn(),
    };

    mockIssuer = {
      discover: jest.fn().mockResolvedValue(mockClientMetadata),
    };

    mockTokenClient = {
      getAccessToken: jest.fn(),
      refreshAccessToken: jest.fn(),
      setTokens: jest.fn(),
      getTokens: jest.fn(),
      clearTokens: jest.fn(),
      introspectToken: jest.fn(),
      revokeToken: jest.fn(),
      exchangeCodeForToken: jest.fn(),
    };

    // Mock TokenClient methods if necessary
    jest
      .spyOn(Token.prototype, 'setTokens')
      .mockImplementation(mockTokenClient.setTokens);
    jest
      .spyOn(Token.prototype, 'getTokens')
      .mockImplementation(mockTokenClient.getTokens);
    jest
      .spyOn(Token.prototype, 'getAccessToken')
      .mockImplementation(mockTokenClient.getAccessToken);
    jest
      .spyOn(Token.prototype, 'refreshAccessToken')
      .mockImplementation(mockTokenClient.refreshAccessToken);
    jest
      .spyOn(Token.prototype, 'clearTokens')
      .mockImplementation(mockTokenClient.clearTokens);
    jest
      .spyOn(Token.prototype, 'introspectToken')
      .mockImplementation(mockTokenClient.introspectToken);
    jest
      .spyOn(Token.prototype, 'revokeToken')
      .mockImplementation(mockTokenClient.revokeToken);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers(); // Ensure timers are reset
  });

  describe.each([
    GrantType.AuthorizationCode,
    GrantType.Password,
    GrantType.DeviceCode,
    GrantType.ClientCredentials,
    GrantType.RefreshToken,
    GrantType.JWTBearer,
    GrantType.SAML2Bearer,
    GrantType.Custom,
  ])('auth with GrantType: %s', (grantType) => {
    beforeEach(() => {
      config = {
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        scopes: [Scopes.OpenId, Scopes.Profile],
        discoveryUrl: 'https://example.com/.well-known/openid-configuration',
        grantType,
        pkce: grantType === GrantType.AuthorizationCode,
        pkceMethod: PkceMethod.S256,
        postLogoutRedirectUri: 'https://example.com/logout-callback',
      };
      auth = new Auth(config, mockLogger, mockIssuer, mockHttpClient);
    });

    describe('constructor', () => {
      it('should create an instance of Auth', () => {
        expect(auth).toBeInstanceOf(Auth);
      });
    });

    // DeviceCode-specific tests
    if (grantType === GrantType.DeviceCode) {
      describe('startDeviceAuthorization', () => {
        it('should initiate device authorization successfully', async () => {
          const deviceEndpoint = 'https://example.com/oauth2/device_authorize';
          const deviceResponse = {
            device_code: 'device-code',
            user_code: 'user-code',
            verification_uri: 'https://example.com/verify',
            expires_in: 1800,
            interval: 5,
          };

          mockIssuer.discover.mockResolvedValueOnce({
            ...mockClientMetadata,
            device_authorization_endpoint: deviceEndpoint,
          } as ClientMetadata);
          mockHttpClient.post.mockResolvedValueOnce(
            JSON.stringify(deviceResponse),
          );

          const result = await auth.startDeviceAuthorization();

          expect(mockIssuer.discover).toHaveBeenCalledTimes(1);
          expect(mockHttpClient.post).toHaveBeenCalledWith(
            deviceEndpoint,
            expect.stringContaining(`client_id=${config.clientId}`),
            { 'Content-Type': 'application/x-www-form-urlencoded' },
          );
          expect(result).toEqual(deviceResponse);
          expect(mockLogger.info).toHaveBeenCalledWith(
            'Device authorization initiated',
          );
        });

        it('should throw ClientError if device_authorization_endpoint is missing', async () => {
          mockIssuer.discover.mockResolvedValueOnce({
            ...mockClientMetadata,
            device_authorization_endpoint: undefined,
          } as ClientMetadata);

          await expect(auth.startDeviceAuthorization()).rejects.toThrow(
            ClientError,
          );

          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to start device authorization',
            { error: expect.any(ClientError) },
          );
        });

        it('should handle errors during device authorization initiation', async () => {
          const deviceEndpoint = 'https://example.com/oauth2/device_authorize';
          mockIssuer.discover.mockResolvedValueOnce({
            ...mockClientMetadata,
            device_authorization_endpoint: deviceEndpoint,
          } as ClientMetadata);
          const mockError = new Error('Device authorization failed');
          mockHttpClient.post.mockRejectedValueOnce(mockError);

          await expect(auth.startDeviceAuthorization()).rejects.toThrow(
            ClientError,
          );
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to start device authorization',
            { error: mockError },
          );
        });
      });

      describe('pollDeviceToken', () => {
        // Separate tests that do not require fake timers
        describe('Immediate Error Handling', () => {
          it('should throw ClientError immediately on unexpected error', async () => {
            const device_code = 'device-code';
            const tokenEndpoint = mockClientMetadata.token_endpoint;

            // Create an Error object with context.body
            const mockError = Object.assign(new Error('Unexpected error'), {
              context: {
                body: JSON.stringify({ error: 'unexpected_error' }),
              },
            });
            mockHttpClient.post.mockRejectedValueOnce(mockError);

            await expect(
              auth.pollDeviceToken(device_code, 5, 10000),
            ).rejects.toThrow(ClientError);

            expect(mockHttpClient.post).toHaveBeenCalledTimes(1);

            const expectedParams = new URLSearchParams({
              grant_type: GrantType.DeviceCode,
              device_code: device_code,
              client_id: config.clientId,
            });

            expect(mockHttpClient.post).toHaveBeenCalledWith(
              tokenEndpoint,
              expectedParams.toString(),
              { 'Content-Type': 'application/x-www-form-urlencoded' },
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
              'Device token polling failed',
              { originalError: mockError },
            );
          });
        });

        // Tests that involve timers
        describe('Timed Polling', () => {
          beforeEach(() => {
            jest.useFakeTimers();
            // Mock the sleep function to resolve immediately
            (sleep as jest.Mock).mockResolvedValue(Promise.resolve());
          });

          afterEach(() => {
            jest.useRealTimers();
            // Reset the sleep mock after each test
            (sleep as jest.Mock).mockReset();
          });

          it('should handle unexpected errors during polling', async () => {
            const device_code = 'device-code';

            const unexpectedError = Object.assign(
              new Error('Unexpected error'),
              {
                context: {
                  body: JSON.stringify({ error: 'unexpected_error' }),
                },
              },
            );
            mockHttpClient.post.mockRejectedValueOnce(unexpectedError);

            const pollPromise = auth.pollDeviceToken(device_code, 5, 10000);

            // First poll: unexpected error, method should throw immediately
            await expect(pollPromise).rejects.toThrow(ClientError);

            expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
              'Device token polling failed',
              {
                originalError: unexpectedError,
              },
            );
          });

          it('should successfully obtain tokens when polling succeeds', async () => {
            const device_code = 'device-code';
            const tokenEndpoint = mockClientMetadata.token_endpoint;
            const tokenResponse = {
              access_token: 'access-token',
              id_token: 'id-token',
              token_type: 'Bearer',
              expires_in: 3600,
            };

            mockHttpClient.post.mockResolvedValueOnce(
              JSON.stringify(tokenResponse),
            );

            const pollPromise = auth.pollDeviceToken(device_code, 5, 10000);

            // Fast-forward until all timers have been executed
            jest.runAllTimers();

            await pollPromise;

            expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
            expect(mockHttpClient.post).toHaveBeenCalledWith(
              tokenEndpoint,
              expect.stringContaining(
                `grant_type=${encodeURIComponent(GrantType.DeviceCode)}`,
              ),
              { 'Content-Type': 'application/x-www-form-urlencoded' },
            );
            expect(mockTokenClient.setTokens).toHaveBeenCalledWith(
              tokenResponse,
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
              'Device authorized and tokens obtained',
            );
          });
        });
      });

      describe('getLogoutUrl', () => {
        it('should generate logout URL with idTokenHint and state', async () => {
          const idTokenHint = 'id-token';
          const state = 'logout-state';
          const expectedLogoutUrl = buildLogoutUrl({
            endSessionEndpoint: mockClientMetadata.end_session_endpoint,
            clientId: config.clientId,
            postLogoutRedirectUri: config.postLogoutRedirectUri,
            idTokenHint,
            state,
          });

          const result = await auth.getLogoutUrl(idTokenHint, state);
          expect(mockIssuer.discover).toHaveBeenCalledTimes(1);
          expect(result).toBe(expectedLogoutUrl);
          expect(mockLogger.debug).toHaveBeenCalledWith(
            'Logout URL generated',
            {
              logoutUrl: result,
            },
          );
        });

        it('should generate logout URL without idTokenHint and state', async () => {
          const expectedLogoutUrl = buildLogoutUrl({
            endSessionEndpoint: mockClientMetadata.end_session_endpoint,
            clientId: config.clientId,
            postLogoutRedirectUri: config.postLogoutRedirectUri,
            idTokenHint: undefined,
            state: undefined,
          });

          const result = await auth.getLogoutUrl();
          expect(result).toBe(expectedLogoutUrl);
          expect(mockLogger.debug).toHaveBeenCalledWith(
            'Logout URL generated',
            {
              logoutUrl: result,
            },
          );
        });

        it('should throw ClientError if end_session_endpoint is missing', async () => {
          mockIssuer.discover.mockResolvedValueOnce({
            ...mockClientMetadata,
            end_session_endpoint: undefined,
          } as ClientMetadata);
          await expect(auth.getLogoutUrl()).rejects.toThrow(ClientError);
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to generate logout URL',
            { error: expect.any(ClientError) },
          );
        });
      });

      describe('getAuthorizationUrl', () => {
        it('should generate an authorization URL with PKCE', async () => {
          const result = await auth.getAuthorizationUrl();
          expect(result.url).toEqual(
            expect.stringContaining(`client_id=${config.clientId}`),
          );
          expect(mockLogger.debug).toHaveBeenCalledWith(
            'Authorization URL generated',
            {
              url: result.url,
            },
          );
        });

        it('should generate an authorization URL without PKCE', async () => {
          // Modify config to disable PKCE if necessary
          config.pkce = false;

          const result = await auth.getAuthorizationUrl();
          expect(result.url).toEqual(
            expect.stringContaining(`client_id=${config.clientId}`),
          );
          expect(mockLogger.debug).toHaveBeenCalledWith(
            'Authorization URL generated',
            {
              url: result.url,
            },
          );
        });

        it('should not generate PKCE details if grantType is not AuthorizationCode', async () => {
          config.pkce = true;
          config.grantType = GrantType.ClientCredentials; // Unsupported for PKCE

          await expect(auth.getAuthorizationUrl()).rejects.toThrow(ClientError);
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to generate authorization URL',
            { error: expect.any(ClientError) },
          );
          expect(mockLogger.debug).not.toHaveBeenCalledWith(
            'Authorization URL generated',
            expect.anything(),
          );
        });

        it('should throw ClientError if authorization_endpoint is missing', async () => {
          mockIssuer.discover.mockResolvedValueOnce({
            ...mockClientMetadata,
            authorization_endpoint: undefined,
          } as ClientMetadata);
          await expect(auth.getAuthorizationUrl()).rejects.toThrow(ClientError);
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to generate authorization URL',
            { error: expect.any(ClientError) },
          );
        });
      });
    }
  });
});
