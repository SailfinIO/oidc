// src/clients/AuthClient.test.ts

jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  sleep: jest.fn(), // Mock the sleep function
}));

import { AuthClient } from './AuthClient';
import { TokenClient } from './TokenClient';
import {
  IDiscoveryClient,
  IDiscoveryConfig,
  IClientConfig,
  ILogger,
  IHttpClient,
  ITokenResponse,
  ITokenClient,
} from '../interfaces';
import { GrantType } from '../enums/GrantType';
import { ClientError } from '../errors/ClientError';
import { buildLogoutUrl, sleep } from '../utils';

describe('AuthClient', () => {
  let mockDiscoveryClient: jest.Mocked<IDiscoveryClient>;
  let mockHttpClient: jest.Mocked<IHttpClient>;
  let mockLogger: jest.Mocked<ILogger>;
  let mockTokenClient: jest.Mocked<ITokenClient>;
  let authClient: AuthClient;
  let config: IClientConfig;

  const mockDiscoveryConfig: IDiscoveryConfig = {
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

    mockDiscoveryClient = {
      getDiscoveryConfig: jest.fn().mockResolvedValue(mockDiscoveryConfig),
    };

    mockTokenClient = {
      getAccessToken: jest.fn(),
      refreshAccessToken: jest.fn(),
      setTokens: jest.fn(),
      getTokens: jest.fn(),
      clearTokens: jest.fn(),
      introspectToken: jest.fn(),
      revokeToken: jest.fn(),
    };

    // Mock TokenClient methods if necessary
    jest
      .spyOn(TokenClient.prototype, 'setTokens')
      .mockImplementation(mockTokenClient.setTokens);
    jest
      .spyOn(TokenClient.prototype, 'getTokens')
      .mockImplementation(mockTokenClient.getTokens);
    jest
      .spyOn(TokenClient.prototype, 'getAccessToken')
      .mockImplementation(mockTokenClient.getAccessToken);
    jest
      .spyOn(TokenClient.prototype, 'refreshAccessToken')
      .mockImplementation(mockTokenClient.refreshAccessToken);
    jest
      .spyOn(TokenClient.prototype, 'clearTokens')
      .mockImplementation(mockTokenClient.clearTokens);
    jest
      .spyOn(TokenClient.prototype, 'introspectToken')
      .mockImplementation(mockTokenClient.introspectToken);
    jest
      .spyOn(TokenClient.prototype, 'revokeToken')
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
  ])('AuthClient with GrantType: %s', (grantType) => {
    beforeEach(() => {
      config = {
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        scopes: ['openid', 'profile'],
        discoveryUrl: 'https://example.com/.well-known/openid-configuration',
        grantType,
        pkce: grantType === GrantType.AuthorizationCode,
        pkceMethod: 'S256',
        postLogoutRedirectUri: 'https://example.com/logout-callback', // Ensure this is set if required
        // Add other necessary config fields if required
      };
      authClient = new AuthClient(
        config,
        mockLogger,
        mockDiscoveryClient,
        mockHttpClient,
      );
    });

    describe('constructor', () => {
      it('should create an instance of AuthClient', () => {
        expect(authClient).toBeInstanceOf(AuthClient);
      });
    });

    describe('getAuthorizationUrl', () => {
      if (
        grantType === GrantType.AuthorizationCode ||
        grantType === GrantType.DeviceCode
      ) {
        it('should generate authorization URL appropriately', async () => {
          const state = 'test-state';
          const nonce = 'test-nonce';

          const result = await authClient.getAuthorizationUrl(state, nonce);

          expect(mockDiscoveryClient.getDiscoveryConfig).toHaveBeenCalledTimes(
            1,
          );
          expect(result.url).toContain(
            mockDiscoveryConfig.authorization_endpoint,
          );
          if (grantType === GrantType.AuthorizationCode && config.pkce) {
            expect(result.codeVerifier).toBeDefined();
          } else {
            expect(result.codeVerifier).toBeUndefined();
          }
          expect(mockLogger.debug).toHaveBeenCalledWith(
            'Authorization URL generated',
            { url: result.url },
          );
        });
      } else {
        it('should throw ClientError if grant type does not support authorization URLs', async () => {
          await expect(authClient.getAuthorizationUrl('state')).rejects.toThrow(
            ClientError,
          );
          expect(mockLogger.debug).not.toHaveBeenCalledWith(
            expect.stringContaining('Authorization URL generated'),
          );
        });
      }
    });

    describe('exchangeCodeForToken', () => {
      it('should exchange code for tokens appropriately', async () => {
        const code = 'auth-code';
        const codeVerifier =
          grantType === GrantType.AuthorizationCode
            ? 'code-verifier'
            : undefined;
        const username = grantType === GrantType.Password ? 'user' : undefined;
        const password = grantType === GrantType.Password ? 'pass' : undefined;

        const mockTokenResponse: ITokenResponse = {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        };

        mockHttpClient.post.mockResolvedValue(
          JSON.stringify(mockTokenResponse),
        );

        if (grantType === GrantType.Password) {
          await authClient.exchangeCodeForToken(
            code,
            codeVerifier,
            username,
            password,
          );
        } else if (
          grantType === GrantType.ClientCredentials ||
          grantType === GrantType.RefreshToken ||
          grantType === GrantType.JWTBearer ||
          grantType === GrantType.SAML2Bearer ||
          grantType === GrantType.Custom
        ) {
          await authClient.exchangeCodeForToken(code, codeVerifier);
        } else {
          await authClient.exchangeCodeForToken(code, codeVerifier);
        }

        expect(mockDiscoveryClient.getDiscoveryConfig).toHaveBeenCalledTimes(1);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          mockDiscoveryConfig.token_endpoint,
          expect.any(String),
          { 'Content-Type': 'application/x-www-form-urlencoded' },
        );

        // Decode the body for assertion
        const body = mockHttpClient.post.mock.calls[0][1];
        const params = new URLSearchParams(body);
        expect(params.get('grant_type')).toBe(grantType);
        expect(params.get('client_id')).toBe(config.clientId);
        expect(params.get('redirect_uri')).toBe(config.redirectUri);

        if (grantType === GrantType.AuthorizationCode && codeVerifier) {
          expect(params.get('code_verifier')).toBe(codeVerifier);
        }

        if (grantType === GrantType.Password) {
          expect(params.get('username')).toBe(username);
          expect(params.get('password')).toBe(password);
        }

        expect(mockTokenClient.setTokens).toHaveBeenCalledWith(
          mockTokenResponse,
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Exchanged grant for tokens',
          {
            grantType: config.grantType,
          },
        );
      });

      if (grantType === GrantType.Password) {
        it('should throw error if username or password is missing for Password grant type', async () => {
          await expect(authClient.exchangeCodeForToken('code')).rejects.toThrow(
            ClientError,
          );
          expect(mockLogger.error).not.toHaveBeenCalled();
        });
      }

      it('should handle errors during token exchange', async () => {
        const code = 'auth-code';
        const codeVerifier =
          grantType === GrantType.AuthorizationCode
            ? 'code-verifier'
            : undefined;
        const username = grantType === GrantType.Password ? 'user' : undefined;
        const password = grantType === GrantType.Password ? 'pass' : undefined;

        const mockError = new Error('Token endpoint error');
        mockHttpClient.post.mockRejectedValue(mockError);

        // Handle Password grant type requiring username and password
        if (grantType === GrantType.Password) {
          await expect(
            authClient.exchangeCodeForToken(
              code,
              codeVerifier,
              username,
              password,
            ),
          ).rejects.toThrow(ClientError);
        } else {
          await expect(
            authClient.exchangeCodeForToken(code, codeVerifier),
          ).rejects.toThrow(ClientError);
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to exchange grant for tokens',
          {
            error: mockError,
            grantType: config.grantType,
          },
        );
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

          mockDiscoveryClient.getDiscoveryConfig.mockResolvedValueOnce({
            ...mockDiscoveryConfig,
            device_authorization_endpoint: deviceEndpoint,
          });
          mockHttpClient.post.mockResolvedValueOnce(
            JSON.stringify(deviceResponse),
          );

          const result = await authClient.startDeviceAuthorization();

          expect(mockDiscoveryClient.getDiscoveryConfig).toHaveBeenCalledTimes(
            1,
          );
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
          mockDiscoveryClient.getDiscoveryConfig.mockResolvedValueOnce({
            ...mockDiscoveryConfig,
            device_authorization_endpoint: undefined,
          });

          await expect(authClient.startDeviceAuthorization()).rejects.toThrow(
            ClientError,
          );

          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to start device authorization',
            { error: expect.any(ClientError) },
          );
        });

        it('should handle errors during device authorization initiation', async () => {
          const deviceEndpoint = 'https://example.com/oauth2/device_authorize';
          mockDiscoveryClient.getDiscoveryConfig.mockResolvedValueOnce({
            ...mockDiscoveryConfig,
            device_authorization_endpoint: deviceEndpoint,
          });
          const mockError = new Error('Device authorization failed');
          mockHttpClient.post.mockRejectedValueOnce(mockError);

          await expect(authClient.startDeviceAuthorization()).rejects.toThrow(
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
            const tokenEndpoint = mockDiscoveryConfig.token_endpoint;

            // Create an Error object with context.body
            const mockError = Object.assign(new Error('Unexpected error'), {
              context: {
                body: JSON.stringify({ error: 'unexpected_error' }),
              },
            });
            mockHttpClient.post.mockRejectedValueOnce(mockError);

            await expect(
              authClient.pollDeviceToken(device_code, 5, 10000),
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

          // it('should successfully poll and obtain tokens for DeviceCode grant', async () => {
          //   const device_code = 'device-code';
          //   const tokenEndpoint = mockDiscoveryConfig.token_endpoint;

          //   // Mock responses: first response is authorization_pending, then success
          //   mockHttpClient.post
          //     .mockRejectedValueOnce(
          //       Object.assign(new Error('authorization_pending'), {
          //         context: {
          //           body: JSON.stringify({ error: 'authorization_pending' }),
          //         },
          //       }),
          //     )
          //     .mockResolvedValueOnce(
          //       JSON.stringify({
          //         access_token: 'new-access-token',
          //         refresh_token: 'new-refresh-token',
          //         expires_in: 3600,
          //         token_type: 'Bearer',
          //       }),
          //     );

          //   // Act
          //   const pollPromise = authClient.pollDeviceToken(
          //     device_code,
          //     5,
          //     10000,
          //   );

          //   // Allow the first rejection to be processed
          //   await Promise.resolve();

          //   // Now, 'sleep' should have been called with 5000 ms
          //   expect(sleep).toHaveBeenCalledWith(5000);

          //   // Advance timers by 5000 ms to simulate the sleep duration
          //   await jest.advanceTimersByTimeAsync(5000);

          //   // Allow the next promise (token exchange) to resolve
          //   await Promise.resolve();

          //   // Now, the pollPromise should resolve successfully
          //   await expect(pollPromise).resolves.toBeUndefined();

          //   // Assert
          //   expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
          //   expect(mockHttpClient.post).toHaveBeenNthCalledWith(
          //     1,
          //     tokenEndpoint,
          //     expect.stringContaining(`grant_type=${GrantType.DeviceCode}`),
          //     { 'Content-Type': 'application/x-www-form-urlencoded' },
          //   );
          //   expect(mockHttpClient.post).toHaveBeenNthCalledWith(
          //     2,
          //     tokenEndpoint,
          //     expect.stringContaining(`grant_type=${GrantType.DeviceCode}`),
          //     { 'Content-Type': 'application/x-www-form-urlencoded' },
          //   );
          //   expect(mockTokenClient.setTokens).toHaveBeenCalledWith({
          //     access_token: 'new-access-token',
          //     refresh_token: 'new-refresh-token',
          //     expires_in: 3600,
          //     token_type: 'Bearer',
          //   });
          //   expect(mockLogger.info).toHaveBeenCalledWith(
          //     'Device authorized and tokens obtained',
          //   );
          // });

          // it('should handle slow_down error by increasing interval', async () => {
          //   const device_code = 'device-code';

          //   // Mock responses: first response is slow_down, then success
          //   mockHttpClient.post
          //     .mockRejectedValueOnce(
          //       Object.assign(new Error('slow_down'), {
          //         context: {
          //           body: JSON.stringify({ error: 'slow_down' }),
          //         },
          //       }),
          //     )
          //     .mockResolvedValueOnce(
          //       JSON.stringify({
          //         access_token: 'new-access-token',
          //         refresh_token: 'new-refresh-token',
          //         expires_in: 3600,
          //         token_type: 'Bearer',
          //       }),
          //     );

          //   // Act
          //   const pollPromise = authClient.pollDeviceToken(
          //     device_code,
          //     5,
          //     20000,
          //   );

          //   // Allow the first rejection to be processed
          //   await Promise.resolve();

          //   // 'sleep' should have been called with initial interval (5000 ms)
          //   expect(sleep).toHaveBeenCalledWith(5000);

          //   // Advance timers by 5000 ms to simulate the initial sleep duration
          //   await jest.advanceTimersByTimeAsync(5000);

          //   // Allow the next rejection to be processed (slow_down)
          //   await Promise.resolve();

          //   // After slow_down, interval should increase to 10 seconds
          //   expect(sleep).toHaveBeenCalledWith(10000);

          //   // Advance timers by 10000 ms to simulate the increased sleep duration
          //   await jest.advanceTimersByTimeAsync(10000);

          //   // Allow the next promise (token exchange) to resolve
          //   await Promise.resolve();

          //   // Now, the pollPromise should resolve successfully
          //   await expect(pollPromise).resolves.toBeUndefined();

          //   // Assert
          //   expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
          //   expect(mockTokenClient.setTokens).toHaveBeenCalledWith({
          //     access_token: 'new-access-token',
          //     refresh_token: 'new-refresh-token',
          //     expires_in: 3600,
          //     token_type: 'Bearer',
          //   });
          //   expect(mockLogger.info).toHaveBeenCalledWith(
          //     'Device authorized and tokens obtained',
          //   );
          // });

          // it('should throw TIMEOUT_ERROR if polling exceeds timeout', async () => {
          //   const device_code = 'device-code';

          //   // Mock responses: always authorization_pending
          //   mockHttpClient.post.mockRejectedValue(
          //     Object.assign(new Error('authorization_pending'), {
          //       context: {
          //         body: JSON.stringify({ error: 'authorization_pending' }),
          //       },
          //     }),
          //   );

          //   const pollPromise = authClient.pollDeviceToken(
          //     device_code,
          //     5,
          //     15000,
          //   );

          //   // First poll
          //   expect(sleep).toHaveBeenCalledWith(5000);
          //   await jest.advanceTimersByTimeAsync(5000);
          //   await Promise.resolve();

          //   // Second poll
          //   expect(sleep).toHaveBeenCalledWith(5000);
          //   await jest.advanceTimersByTimeAsync(5000);
          //   await Promise.resolve();

          //   // Third poll would exceed timeout
          //   expect(sleep).toHaveBeenCalledWith(5000);
          //   await jest.advanceTimersByTimeAsync(5000);
          //   await Promise.resolve();

          //   await expect(pollPromise).rejects.toThrow(ClientError);
          //   expect(mockLogger.error).toHaveBeenCalledWith(
          //     'Device token polling timed out',
          //     { error: expect.any(ClientError) },
          //   );
          // });

          // it('should throw DEVICE_CODE_EXPIRED if expired_token is received', async () => {
          //   const device_code = 'device-code';

          //   // Mock responses: first authorization_pending, then expired_token
          //   mockHttpClient.post
          //     .mockRejectedValueOnce(
          //       Object.assign(new Error('authorization_pending'), {
          //         context: {
          //           body: JSON.stringify({ error: 'authorization_pending' }),
          //         },
          //       }),
          //     )
          //     .mockRejectedValueOnce(
          //       Object.assign(new Error('expired_token'), {
          //         context: {
          //           body: JSON.stringify({ error: 'expired_token' }),
          //         },
          //       }),
          //     );

          //   // Act
          //   const pollPromise = authClient.pollDeviceToken(
          //     device_code,
          //     5,
          //     20000,
          //   );

          //   // First poll
          //   await Promise.resolve();
          //   expect(sleep).toHaveBeenCalledWith(5000);
          //   await jest.advanceTimersByTimeAsync(5000);
          //   await Promise.resolve();

          //   // Second poll: expired_token
          //   expect(sleep).toHaveBeenCalledWith(5000);
          //   await jest.advanceTimersByTimeAsync(5000);
          //   await Promise.resolve();

          //   // Now, the pollPromise should reject with DEVICE_CODE_EXPIRED
          //   await expect(pollPromise).rejects.toThrow(ClientError);
          //   expect(mockLogger.error).toHaveBeenCalledWith(
          //     'Device code expired',
          //     { error: expect.any(ClientError) },
          //   );
          // });

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

            const pollPromise = authClient.pollDeviceToken(
              device_code,
              5,
              10000,
            );

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
        });
      });

      describe('getLogoutUrl', () => {
        it('should generate logout URL with idTokenHint and state', async () => {
          const idTokenHint = 'id-token';
          const state = 'logout-state';
          const expectedLogoutUrl = buildLogoutUrl({
            endSessionEndpoint: mockDiscoveryConfig.end_session_endpoint,
            clientId: config.clientId,
            postLogoutRedirectUri: config.postLogoutRedirectUri,
            idTokenHint,
            state,
          });

          const result = await authClient.getLogoutUrl(idTokenHint, state);
          expect(mockDiscoveryClient.getDiscoveryConfig).toHaveBeenCalledTimes(
            1,
          );
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
            endSessionEndpoint: mockDiscoveryConfig.end_session_endpoint,
            clientId: config.clientId,
            postLogoutRedirectUri: config.postLogoutRedirectUri,
            idTokenHint: undefined,
            state: undefined,
          });

          const result = await authClient.getLogoutUrl();
          expect(result).toBe(expectedLogoutUrl);
          expect(mockLogger.debug).toHaveBeenCalledWith(
            'Logout URL generated',
            {
              logoutUrl: result,
            },
          );
        });

        it('should throw ClientError if end_session_endpoint is missing', async () => {
          mockDiscoveryClient.getDiscoveryConfig.mockResolvedValueOnce({
            ...mockDiscoveryConfig,
            end_session_endpoint: undefined,
          });
          await expect(authClient.getLogoutUrl()).rejects.toThrow(ClientError);
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to generate logout URL',
            { error: expect.any(ClientError) },
          );
        });
      });
    }
  });
});
