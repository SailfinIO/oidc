// src/classes/Auth.test.ts

import { Auth } from './Auth';
import { Token } from './Token';
import {
  IIssuer,
  ClientMetadata,
  IClientConfig,
  ILogger,
  IToken,
  IAuth,
  IPkce,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';
import {
  buildLogoutUrl,
  sleep,
  parseFragment,
  generateRandomString,
} from '../utils';
import { PkceMethod, Scopes, GrantType } from '../enums';
import { JwtValidator } from './JwtValidator';
// Mock utilities
jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  sleep: jest.fn(),
  generateRandomString: jest.fn(),
  parseFragment: jest.fn(),
  // buildAuthorizationUrl: jest.fn(),
  buildLogoutUrl: jest.fn(),
}));

let mockIssuer: jest.Mocked<IIssuer>;
let mockLogger: jest.Mocked<ILogger>;
let mockTokenClient: jest.Mocked<IToken>;

// Constants for reuse
const MOCK_CLIENT_ID = 'test-client-id';
const MOCK_REDIRECT_URI = 'https://example.com/callback';
const MOCK_POST_LOGOUT_URI = 'https://example.com/logout-callback';
const MOCK_DISCOVERY_URL =
  'https://example.com/.well-known/openid-configuration';
const MOCK_CLIENT_METADATA: Partial<ClientMetadata> = {
  issuer: 'https://example.com/',
  authorization_endpoint: 'https://example.com/oauth2/authorize',
  token_endpoint: 'https://example.com/oauth2/token',
  end_session_endpoint: 'https://example.com/oauth2/logout',
  jwks_uri: 'https://example.com/.well-known/jwks.json',
  userinfo_endpoint: 'https://example.com/oauth2/userinfo',
  device_authorization_endpoint: 'https://example.com/oauth2/device_authorize',
};

// Helper function to create Auth instances
const createAuthInstance = (
  grantType: GrantType,
  configOverrides?: Partial<IClientConfig>,
): IAuth => {
  const config: IClientConfig = {
    clientId: MOCK_CLIENT_ID,
    redirectUri: MOCK_REDIRECT_URI,
    scopes: [Scopes.OpenId, Scopes.Profile],
    discoveryUrl: MOCK_DISCOVERY_URL,
    grantType,
    pkce: grantType === GrantType.AuthorizationCode,
    pkceMethod: PkceMethod.S256,
    postLogoutRedirectUri: MOCK_POST_LOGOUT_URI,
    ...configOverrides,
  };
  return new Auth(config, mockLogger, mockIssuer, mockTokenClient);
};

// Helper function to mock fetch responses
const mockFetchResponse = (data: any, status: number = 200) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
};

describe('Auth', () => {
  let auth: IAuth;

  beforeEach(() => {
    // Initialize mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };

    mockIssuer = {
      discover: jest.fn().mockResolvedValue(MOCK_CLIENT_METADATA),
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

    // Mock TokenClient methods
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

    // Mock fetch globally
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
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
  ])('GrantType: %s', (grantType) => {
    beforeEach(() => {
      auth = createAuthInstance(grantType);
    });

    describe('constructor', () => {
      it('should create an instance of Auth', () => {
        expect(auth).toBeInstanceOf(Auth);
      });
    });

    // DeviceCode-specific tests
    if (grantType === GrantType.DeviceCode) {
      describe('DeviceCode Flow', () => {
        describe('startDeviceAuthorization', () => {
          it('should initiate device authorization successfully', async () => {
            const deviceResponse = {
              device_code: 'device-code',
              user_code: 'user-code',
              verification_uri: 'https://example.com/verify',
              expires_in: 1800,
              interval: 5,
            };

            mockIssuer.discover.mockResolvedValueOnce({
              ...MOCK_CLIENT_METADATA,
              device_authorization_endpoint:
                'https://example.com/oauth2/device_authorize',
            } as ClientMetadata);

            mockFetchResponse(deviceResponse);

            const result = await auth.startDeviceAuthorization();

            expect(mockIssuer.discover).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledWith(
              'https://example.com/oauth2/device_authorize',
              {
                method: 'POST',
                body: expect.stringContaining(
                  `client_id=${encodeURIComponent(MOCK_CLIENT_ID)}`,
                ),
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
              },
            );
            expect(result).toEqual(deviceResponse);
            expect(mockLogger.info).toHaveBeenCalledWith(
              'Device authorization initiated',
            );
          });

          it('should throw ClientError if device_authorization_endpoint is missing', async () => {
            mockIssuer.discover.mockResolvedValueOnce({
              ...MOCK_CLIENT_METADATA,
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
            mockIssuer.discover.mockResolvedValueOnce({
              ...MOCK_CLIENT_METADATA,
              device_authorization_endpoint:
                'https://example.com/oauth2/device_authorize',
            } as ClientMetadata);

            const mockError = new Error('Device authorization failed');
            (global.fetch as jest.Mock).mockRejectedValueOnce(mockError);

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
          describe('Immediate Error Handling', () => {
            it('should throw ClientError immediately on unexpected error', async () => {
              const device_code = 'device-code';
              const mockError = Object.assign(new Error('Unexpected error'), {
                context: {
                  body: JSON.stringify({ error: 'unexpected_error' }),
                },
              });

              (global.fetch as jest.Mock).mockRejectedValueOnce(mockError);

              await expect(
                auth.pollDeviceToken(device_code, 5, 10000),
              ).rejects.toThrow(ClientError);

              expect(global.fetch).toHaveBeenCalledTimes(1);
              expect(global.fetch).toHaveBeenCalledWith(
                MOCK_CLIENT_METADATA.token_endpoint!,
                {
                  method: 'POST',
                  body: new URLSearchParams({
                    grant_type: GrantType.DeviceCode,
                    device_code,
                    client_id: MOCK_CLIENT_ID,
                  }).toString(),
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                },
              );
              expect(mockLogger.error).toHaveBeenCalledWith(
                'Device token polling failed',
                { originalError: mockError },
              );
            });
          });

          it('should log warnings when error response is invalid JSON and throw TOKEN_POLLING_ERROR', async () => {
            const device_code = 'device-code';
            const interval = 1; // seconds
            const timeout = 3000; // 3 seconds

            // Mock fetch to throw an error with invalid JSON in context.body
            const invalidJsonError = Object.assign(new Error('Invalid JSON'), {
              context: { body: 'invalid-json' },
            });
            (global.fetch as jest.Mock).mockRejectedValueOnce(invalidJsonError);

            // Initiate the polling
            const pollPromise = auth.pollDeviceToken(
              device_code,
              interval,
              timeout,
            );

            // Since handlePollingError throws immediately, no need to advance timers
            await expect(pollPromise).rejects.toThrow(
              'Device token polling failed',
            );

            // Verify that the logger.warn was called with a SyntaxError
            expect(mockLogger.warn).toHaveBeenCalledWith(
              'Failed to parse error response as JSON',
              expect.objectContaining({
                originalError: expect.any(SyntaxError),
              }),
            );

            // Verify that the logger.warn was called with the response body
            expect(mockLogger.warn).toHaveBeenCalledWith(
              'Error response from token endpoint',
              { response: 'invalid-json' },
            );

            // Verify that the logger.error was called with 'Device token polling failed'
            expect(mockLogger.error).toHaveBeenCalledWith(
              'Device token polling failed',
              {
                originalError: invalidJsonError,
              },
            );
          });

          describe('handlePollingError coverage', () => {
            beforeEach(() => {
              jest.useFakeTimers();
              (sleep as jest.Mock).mockResolvedValue(Promise.resolve());
            });

            afterEach(() => {
              jest.useRealTimers();
            });

            it('should handle "authorization_pending" by sleeping and continuing polling', async () => {
              const device_code = 'test-device-code';

              // First fetch attempt: simulate "authorization_pending" error
              (global.fetch as jest.Mock).mockRejectedValueOnce(
                Object.assign(new Error('authorization_pending'), {
                  context: {
                    body: JSON.stringify({ error: 'authorization_pending' }),
                  },
                }),
              );

              // Second fetch attempt: return a valid token so we can exit the loop
              (global.fetch as jest.Mock).mockResolvedValueOnce(
                new Response(
                  JSON.stringify({
                    access_token: 'access-token',
                    token_type: 'Bearer',
                    expires_in: 3600,
                  }),
                  {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                  },
                ),
              );

              await auth.pollDeviceToken(device_code, 5, 30000);

              // We expect `sleep` to have been called once with 5 seconds
              expect(sleep).toHaveBeenCalledWith(5 * 1000);

              // We also expect we eventually get tokens set
              expect(mockTokenClient.setTokens).toHaveBeenCalledWith({
                access_token: 'access-token',
                token_type: 'Bearer',
                expires_in: 3600,
              });
            });

            it('should handle "slow_down" by adding 5 to interval, sleeping, then continuing polling', async () => {
              const device_code = 'test-device-code';

              // First fetch attempt: simulate "slow_down" error
              (global.fetch as jest.Mock).mockRejectedValueOnce(
                Object.assign(new Error('slow_down'), {
                  context: {
                    body: JSON.stringify({ error: 'slow_down' }),
                  },
                }),
              );

              // Second fetch attempt: return a valid token so we can exit the loop
              (global.fetch as jest.Mock).mockResolvedValueOnce(
                new Response(
                  JSON.stringify({
                    access_token: 'access-token',
                    token_type: 'Bearer',
                    expires_in: 3600,
                  }),
                  {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                  },
                ),
              );

              await auth.pollDeviceToken(device_code, 5, 30000);

              // After "slow_down", the interval should increment by 5 => 10
              // We expect `sleep` to have been called with 10 * 1000
              expect(sleep).toHaveBeenCalledWith(10 * 1000);

              // Then we get tokens set
              expect(mockTokenClient.setTokens).toHaveBeenCalledWith({
                access_token: 'access-token',
                token_type: 'Bearer',
                expires_in: 3600,
              });
            });

            it('should handle "expired_token" by logging an error and throwing ClientError', async () => {
              const device_code = 'test-device-code';

              // Simulate "expired_token" error
              (global.fetch as jest.Mock).mockRejectedValueOnce(
                Object.assign(new Error('expired_token'), {
                  context: {
                    body: JSON.stringify({ error: 'expired_token' }),
                  },
                }),
              );

              await expect(
                auth.pollDeviceToken(device_code, 5, 30000),
              ).rejects.toThrowError('Device code expired');

              // We also check that the logger.error was called for the "expired_token" case
              expect(mockLogger.error).toHaveBeenCalledWith(
                'Device code expired',
                {
                  error: expect.any(ClientError),
                },
              );

              // And we expect NO token was ever set
              expect(mockTokenClient.setTokens).not.toHaveBeenCalled();
            });
          });

          describe('Timed Polling', () => {
            beforeEach(() => {
              jest.useFakeTimers();
              (sleep as jest.Mock).mockResolvedValue(Promise.resolve());
            });

            afterEach(() => {
              jest.useRealTimers();
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

              (global.fetch as jest.Mock).mockRejectedValueOnce(
                unexpectedError,
              );

              const pollPromise = auth.pollDeviceToken(device_code, 5, 10000);

              await expect(pollPromise).rejects.toThrow(ClientError);

              expect(global.fetch).toHaveBeenCalledTimes(1);
              expect(mockLogger.error).toHaveBeenCalledWith(
                'Device token polling failed',
                { originalError: unexpectedError },
              );
            });

            it('should throw ClientError when polling times out', async () => {
              const device_code = 'device-code';
              const interval = 1; // seconds
              const timeout = 3000; // 3 seconds

              // Mock fetch to always return 'authorization_pending'
              const pendingError = Object.assign(
                new Error('authorization_pending'),
                {
                  context: {
                    body: JSON.stringify({ error: 'authorization_pending' }),
                  },
                },
              );
              (global.fetch as jest.Mock).mockRejectedValue(pendingError);

              const pollPromise = auth.pollDeviceToken(
                device_code,
                interval,
                timeout,
              );

              // Simulate the passage of time by advancing timers
              for (let i = 0; i < 4; i++) {
                // 4 intervals * 1s = 4s > 3s
                await Promise.resolve(); // Allow any pending promises to resolve
                jest.advanceTimersByTime(interval * 1000); // Advance time by interval
                await Promise.resolve(); // Allow any pending promises to resolve
              }

              await expect(pollPromise).rejects.toThrow(
                'Device code polling timed out',
              );

              // Verify that the logger.error was called with the correct message and error
              expect(mockLogger.error).toHaveBeenCalledWith(
                'Device token polling timed out',
                {
                  error: expect.any(ClientError),
                },
              );

              // Optionally, verify that the correct ClientError was thrown
              try {
                await pollPromise;
              } catch (error) {
                expect(error).toBeInstanceOf(ClientError);
                expect(error.message).toBe('Device code polling timed out');
                expect(error.code).toBe('TIMEOUT_ERROR');
              }
            });

            it('should successfully obtain tokens when polling succeeds', async () => {
              const device_code = 'device-code';
              const tokenResponse = {
                access_token: 'access-token',
                id_token: 'id-token',
                token_type: 'Bearer',
                expires_in: 3600,
              };

              mockFetchResponse(tokenResponse);

              const pollPromise = auth.pollDeviceToken(device_code, 5, 10000);

              jest.runAllTimers();

              await pollPromise;

              expect(global.fetch).toHaveBeenCalledTimes(1);
              expect(global.fetch).toHaveBeenCalledWith(
                MOCK_CLIENT_METADATA.token_endpoint!,
                {
                  method: 'POST',
                  body: expect.stringContaining(
                    `grant_type=${encodeURIComponent(GrantType.DeviceCode)}`,
                  ),
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                },
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
              endSessionEndpoint: MOCK_CLIENT_METADATA.end_session_endpoint!,
              clientId: MOCK_CLIENT_ID,
              postLogoutRedirectUri: MOCK_POST_LOGOUT_URI,
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
              endSessionEndpoint: MOCK_CLIENT_METADATA.end_session_endpoint!,
              clientId: MOCK_CLIENT_ID,
              postLogoutRedirectUri: MOCK_POST_LOGOUT_URI,
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
              ...MOCK_CLIENT_METADATA,
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
          const buildAuthorizationUrlSpy = () =>
            jest.spyOn(require('../utils'), 'buildAuthorizationUrl');

          it('should generate an authorization URL with PKCE', async () => {
            const utils = require('../utils');
            (utils.generateRandomString as jest.Mock)
              .mockReturnValueOnce('state123')
              .mockReturnValueOnce('nonce123');

            const buildSpy = buildAuthorizationUrlSpy().mockReturnValue(
              'https://example.com/oauth2/authorize?client_id=test-client-id',
            );

            const result = await auth.getAuthorizationUrl();

            expect(result.url).toContain(
              `client_id=${encodeURIComponent(MOCK_CLIENT_ID)}`,
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
              'Authorization URL generated',
              {
                url: result.url,
              },
            );

            buildSpy.mockRestore();
          });

          it('should generate an authorization URL without PKCE', async () => {
            auth = createAuthInstance(GrantType.AuthorizationCode, {
              pkce: false,
            });

            const utils = require('../utils');
            (utils.generateRandomString as jest.Mock)
              .mockReturnValueOnce('state123')
              .mockReturnValueOnce('nonce123');

            const buildSpy = buildAuthorizationUrlSpy().mockReturnValue(
              'https://example.com/oauth2/authorize?client_id=test-client-id',
            );

            const result = await auth.getAuthorizationUrl();

            expect(result.url).toContain(
              `client_id=${encodeURIComponent(MOCK_CLIENT_ID)}`,
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
              'Authorization URL generated',
              {
                url: result.url,
              },
            );

            buildSpy.mockRestore();
          });

          it('should not generate PKCE details if grantType is not AuthorizationCode', async () => {
            auth = createAuthInstance(GrantType.ClientCredentials, {
              pkce: true,
            });

            await expect(auth.getAuthorizationUrl()).rejects.toThrow(
              ClientError,
            );

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
              ...MOCK_CLIENT_METADATA,
              authorization_endpoint: undefined,
            } as ClientMetadata);

            await expect(auth.getAuthorizationUrl()).rejects.toThrow(
              ClientError,
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
              'Failed to generate authorization URL',
              { error: expect.any(ClientError) },
            );
          });

          // Removed duplicate test case for 'authorization_endpoint is missing'
        });

        describe('handleRedirect', () => {
          let authInstance: IAuth;
          let configInstance: IClientConfig;

          beforeEach(() => {
            configInstance = {
              clientId: MOCK_CLIENT_ID,
              redirectUri: MOCK_REDIRECT_URI,
              scopes: [Scopes.OpenId, Scopes.Profile],
              discoveryUrl: MOCK_DISCOVERY_URL,
              grantType: GrantType.AuthorizationCode,
              pkce: true,
              pkceMethod: PkceMethod.S256,
              postLogoutRedirectUri: MOCK_POST_LOGOUT_URI,
            };
            authInstance = new Auth(
              configInstance,
              mockLogger,
              mockIssuer,
              mockTokenClient,
            );
          });

          it('should handle redirect successfully and validate ID token', async () => {
            const code = 'auth-code';
            const returnedState = 'valid-state';
            const expectedNonce = 'generated-nonce';

            // Mock state retrieval
            (authInstance as Auth)['state'].addState(
              returnedState,
              expectedNonce,
            );

            // Mock token exchange
            const tokenResponse = {
              access_token: 'access-token',
              id_token: 'id-token',
              token_type: 'Bearer',
              expires_in: 3600,
            };
            mockTokenClient.exchangeCodeForToken.mockResolvedValueOnce();
            mockTokenClient.getTokens.mockReturnValueOnce(tokenResponse);

            // Mock issuer discovery
            mockIssuer.discover.mockResolvedValueOnce(
              MOCK_CLIENT_METADATA as ClientMetadata,
            );

            // Create JWT Payload
            const jwtPayload = {
              sub: '12345',
              iss: 'https://example.com/',
              aud: MOCK_CLIENT_ID,
              nonce: expectedNonce,
              exp: Math.floor(Date.now() / 1000) + 3600,
            };

            // Mock JWT validation
            jest
              .spyOn(JwtValidator.prototype, 'validateIdToken')
              .mockResolvedValueOnce(jwtPayload);

            await authInstance.handleRedirect(code, returnedState);

            expect(mockTokenClient.exchangeCodeForToken).toHaveBeenCalledWith(
              code,
              // Accessing private method via type assertion
              (authInstance as Auth).getCodeVerifier(),
            );
            expect(mockTokenClient.getTokens).toHaveBeenCalled();
            expect(mockIssuer.discover).toHaveBeenCalled();
            expect(JwtValidator.prototype.validateIdToken).toHaveBeenCalledWith(
              'id-token',
              expectedNonce,
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
              'ID token validated successfully',
            );
            // Verify code verifier is cleared
            expect((authInstance as Auth).getCodeVerifier()).toBeNull();
          });

          it('should throw ClientError if state does not match', async () => {
            const code = 'auth-code';
            const returnedState = 'invalid-state';

            await expect(
              authInstance.handleRedirect(code, returnedState),
            ).rejects.toThrow(ClientError);

            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockTokenClient.exchangeCodeForToken).not.toHaveBeenCalled();
          });

          it('should throw ClientError if token exchange fails', async () => {
            const code = 'auth-code';
            const returnedState = 'valid-state';
            const expectedNonce = 'generated-nonce';

            (authInstance as Auth)['state'].addState(
              returnedState,
              expectedNonce,
            );
            const exchangeError = new ClientError('Exchange failed');
            mockTokenClient.exchangeCodeForToken.mockRejectedValueOnce(
              exchangeError,
            );

            await expect(
              authInstance.handleRedirect(code, returnedState),
            ).rejects.toThrow(ClientError);

            expect(mockLogger.error).toHaveBeenCalledWith(
              'Failed to exchange authorization code for tokens',
              { error: exchangeError },
            );
          });

          it('should log a warning if no ID token is returned', async () => {
            const code = 'auth-code';
            const returnedState = 'valid-state';
            const expectedNonce = 'generated-nonce';

            (authInstance as Auth)['state'].addState(
              returnedState,
              expectedNonce,
            );

            const tokenResponse = {
              access_token: 'access-token',
              token_type: 'Bearer',
              expires_in: 3600,
            };
            mockTokenClient.exchangeCodeForToken.mockResolvedValueOnce();
            mockTokenClient.getTokens.mockReturnValueOnce(tokenResponse);

            await authInstance.handleRedirect(code, returnedState);

            expect(mockLogger.warn).toHaveBeenCalledWith(
              'No ID token returned to validate',
            );
            expect((authInstance as Auth).getCodeVerifier()).toBeNull();
          });

          it('should throw ClientError if ID token validation fails', async () => {
            const code = 'auth-code';
            const returnedState = 'valid-state';
            const expectedNonce = 'generated-nonce';

            (authInstance as Auth)['state'].addState(
              returnedState,
              expectedNonce,
            );

            const tokenResponse = {
              access_token: 'access-token',
              id_token: 'invalid-id-token',
              token_type: 'Bearer',
              expires_in: 3600,
            };
            mockTokenClient.exchangeCodeForToken.mockResolvedValueOnce();
            mockTokenClient.getTokens.mockReturnValueOnce(tokenResponse);

            mockIssuer.discover.mockResolvedValueOnce(
              MOCK_CLIENT_METADATA as ClientMetadata,
            );
            jest
              .spyOn(JwtValidator.prototype, 'validateIdToken')
              .mockRejectedValueOnce(new Error('Invalid ID token'));

            await expect(
              authInstance.handleRedirect(code, returnedState),
            ).rejects.toThrow();

            expect(mockLogger.error).toHaveBeenCalledWith(
              'Failed to validate ID token',
              { error: expect.any(Error) },
            );
          });
        });
      });
    }
  });

  describe('Implicit Flow', () => {
    beforeEach(() => {
      auth = createAuthInstance(GrantType.Implicit, { pkce: false });
    });

    describe('handleRedirectForImplicitFlow', () => {
      it('should handle redirect successfully with id_token', async () => {
        const fragment =
          '#access_token=access-token&id_token=id-token&state=valid-state&token_type=Bearer&expires_in=3600';

        // Mock parseFragment
        (parseFragment as jest.Mock).mockReturnValue({
          access_token: 'access-token',
          id_token: 'id-token',
          state: 'valid-state',
          token_type: 'Bearer',
          expires_in: '3600',
        });

        // Mock state retrieval
        (auth as Auth)['state'].addState('valid-state', 'expected-nonce');
        jest
          .spyOn((auth as Auth)['state'], 'getNonce')
          .mockResolvedValue('expected-nonce');

        // Mock issuer discovery
        mockIssuer.discover.mockResolvedValueOnce(
          MOCK_CLIENT_METADATA as ClientMetadata,
        );

        // Mock JWT validation
        jest
          .spyOn(JwtValidator.prototype, 'validateIdToken')
          .mockResolvedValueOnce({
            sub: '12345',
            iss: 'https://example.com/',
            aud: MOCK_CLIENT_ID,
            nonce: 'expected-nonce',
            exp: Math.floor(Date.now() / 1000) + 3600,
          });

        // Mock token exchange
        mockTokenClient.setTokens.mockImplementation();

        await auth.handleRedirectForImplicitFlow(fragment);

        expect(parseFragment).toHaveBeenCalledWith(fragment);
        expect((auth as Auth)['state'].getNonce).toHaveBeenCalledWith(
          'valid-state',
        );
        expect(mockIssuer.discover).toHaveBeenCalledTimes(1);
        expect(JwtValidator.prototype.validateIdToken).toHaveBeenCalledWith(
          'id-token',
          'expected-nonce',
        );
        expect(mockTokenClient.setTokens).toHaveBeenCalledWith({
          access_token: 'access-token',
          id_token: 'id-token',
          token_type: 'Bearer',
          expires_in: 3600,
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          'ID token validated successfully',
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Tokens obtained and stored successfully',
        );
        expect((auth as Auth).getCodeVerifier()).toBeNull();
      });

      it('should handle redirect successfully without id_token', async () => {
        const fragment =
          '#access_token=access-token&state=valid-state&token_type=Bearer&expires_in=3600';

        // Mock parseFragment
        (parseFragment as jest.Mock).mockReturnValue({
          access_token: 'access-token',
          state: 'valid-state',
          token_type: 'Bearer',
          expires_in: '3600',
        });

        // Mock state retrieval
        (auth as Auth)['state'].addState('valid-state', 'expected-nonce');
        jest
          .spyOn((auth as Auth)['state'], 'getNonce')
          .mockResolvedValue('expected-nonce');

        // Mock token storage
        mockTokenClient.setTokens.mockImplementation();

        await auth.handleRedirectForImplicitFlow(fragment);

        expect(parseFragment).toHaveBeenCalledWith(fragment);
        expect((auth as Auth)['state'].getNonce).toHaveBeenCalledWith(
          'valid-state',
        );
        expect(mockIssuer.discover).not.toHaveBeenCalled();
        expect(JwtValidator.prototype.validateIdToken).not.toHaveBeenCalled();
        expect(mockTokenClient.setTokens).toHaveBeenCalledWith({
          access_token: 'access-token',
          id_token: undefined,
          token_type: 'Bearer',
          expires_in: 3600,
        });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'No ID token returned to validate',
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Tokens obtained and stored successfully',
        );
        expect((auth as Auth).getCodeVerifier()).toBeNull();
      });

      it('should throw ClientError if fragment contains an error', async () => {
        const fragment =
          '#error=access_denied&error_description=User denied access';

        // Mock parseFragment
        (parseFragment as jest.Mock).mockReturnValue({
          error: 'access_denied',
          error_description: 'User denied access',
        });

        await expect(
          auth.handleRedirectForImplicitFlow(fragment),
        ).rejects.toThrow(ClientError);

        expect(parseFragment).toHaveBeenCalledWith(fragment);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error in implicit flow redirect',
          {
            error: 'access_denied',
            error_description: 'User denied access',
          },
        );
      });

      it('should throw ClientError if access_token is missing', async () => {
        const fragment =
          '#id_token=id-token&state=valid-state&token_type=Bearer&expires_in=3600';

        // Mock parseFragment
        (parseFragment as jest.Mock).mockReturnValue({
          id_token: 'id-token',
          state: 'valid-state',
          token_type: 'Bearer',
          expires_in: '3600',
        });

        await expect(
          auth.handleRedirectForImplicitFlow(fragment),
        ).rejects.toThrow(ClientError);

        expect(parseFragment).toHaveBeenCalledWith(fragment);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should throw ClientError if state is missing', async () => {
        const fragment =
          '#access_token=access-token&id_token=id-token&token_type=Bearer&expires_in=3600';

        // Mock parseFragment
        (parseFragment as jest.Mock).mockReturnValue({
          access_token: 'access-token',
          id_token: 'id-token',
          token_type: 'Bearer',
          expires_in: '3600',
        });

        await expect(
          auth.handleRedirectForImplicitFlow(fragment),
        ).rejects.toThrow(ClientError);

        expect(parseFragment).toHaveBeenCalledWith(fragment);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should throw ClientError if state does not match any stored state', async () => {
        const fragment =
          '#access_token=access-token&id_token=id-token&state=invalid-state&token_type=Bearer&expires_in=3600';

        // Mock parseFragment
        (parseFragment as jest.Mock).mockReturnValue({
          access_token: 'access-token',
          id_token: 'id-token',
          state: 'invalid-state',
          token_type: 'Bearer',
          expires_in: '3600',
        });

        // Mock state retrieval to return null
        jest.spyOn((auth as Auth)['state'], 'getNonce').mockResolvedValue(null);

        await expect(
          auth.handleRedirectForImplicitFlow(fragment),
        ).rejects.toThrow(ClientError);

        expect(parseFragment).toHaveBeenCalledWith(fragment);
        expect((auth as Auth)['state'].getNonce).toHaveBeenCalledWith(
          'invalid-state',
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });
  });

  describe('PKCE generation', () => {
    let authWithPkce: Auth;
    let pkceServiceMock: jest.Mocked<IPkce>;

    beforeEach(() => {
      pkceServiceMock = {
        generatePkce: jest.fn(),
      };

      // IMPORTANT: We have to re-inject the mock return value for generateRandomString:
      (generateRandomString as jest.Mock).mockReturnValue('test-random-string');

      authWithPkce = new Auth(
        {
          clientId: MOCK_CLIENT_ID,
          redirectUri: MOCK_REDIRECT_URI,
          scopes: [Scopes.OpenId, Scopes.Profile],
          discoveryUrl: MOCK_DISCOVERY_URL,
          grantType: GrantType.AuthorizationCode,
          pkce: true,
          pkceMethod: PkceMethod.S256,
          postLogoutRedirectUri: MOCK_POST_LOGOUT_URI,
        },
        mockLogger,
        mockIssuer,
        mockTokenClient,
        pkceServiceMock, // so we can control generatePkce
      );
    });

    it('should generate PKCE successfully with valid pkceMethod', async () => {
      // 1) Mock PKCE generation to return codeVerifier & codeChallenge
      pkceServiceMock.generatePkce.mockReturnValue({
        codeVerifier: 'test_verifier',
        codeChallenge: 'test_challenge',
      });

      // 2) Also mock discover call so we have a valid authorization_endpoint
      mockIssuer.discover.mockResolvedValue({
        ...MOCK_CLIENT_METADATA,
        authorization_endpoint: 'https://example.com/oauth2/authorize',
      } as ClientMetadata);

      // 3) Call the method that triggers PKCE generation (getAuthorizationUrl)
      const { url, state } = await authWithPkce.getAuthorizationUrl();

      // 4) Assertions
      expect(state).toBeDefined();
      expect(url).toContain('test_challenge'); // optional: depends on your buildAuthorizationUrl logic
      expect(mockLogger.warn).not.toHaveBeenCalled(); // We expect no warning since pkceMethod is valid

      // Check that the codeVerifier was set internally
      expect(authWithPkce.getCodeVerifier()).toBe('test_verifier');
    });

    it('should log a warning and omit code_challenge_method if pkceMethod is invalid', async () => {
      // Re-instantiate Auth with an invalid pkceMethod
      authWithPkce = new Auth(
        {
          clientId: MOCK_CLIENT_ID,
          redirectUri: MOCK_REDIRECT_URI,
          scopes: [Scopes.OpenId, Scopes.Profile],
          discoveryUrl: MOCK_DISCOVERY_URL,
          grantType: GrantType.AuthorizationCode,
          pkce: true,
          pkceMethod: 'INVALID_METHOD' as PkceMethod, // cast to bypass TS check
          postLogoutRedirectUri: MOCK_POST_LOGOUT_URI,
        },
        mockLogger,
        mockIssuer,
        mockTokenClient,
        pkceServiceMock,
      );

      // Mock PKCE generation success
      pkceServiceMock.generatePkce.mockReturnValue({
        codeVerifier: 'test_verifier',
        codeChallenge: 'test_challenge',
      });
      mockIssuer.discover.mockResolvedValue({
        ...MOCK_CLIENT_METADATA,
        authorization_endpoint: 'https://example.com/oauth2/authorize',
      } as ClientMetadata);

      await authWithPkce.getAuthorizationUrl();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid pkceMethod provided. Omitting code_challenge_method.',
      );
    });

    it('should throw ClientError if pkceService.generatePkce() fails', async () => {
      // 1) Simulate generatePkce throwing an error
      const pkceError = new Error('PKCE generation failed');
      pkceServiceMock.generatePkce.mockImplementation(() => {
        throw pkceError;
      });

      // 2) Mock discover call for completeness
      mockIssuer.discover.mockResolvedValue({
        ...MOCK_CLIENT_METADATA,
        authorization_endpoint: 'https://example.com/oauth2/authorize',
      } as ClientMetadata);

      // 3) We expect an error from getAuthorizationUrl
      await expect(authWithPkce.getAuthorizationUrl()).rejects.toThrow(
        ClientError,
      );

      // 4) Verify the error logging
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate PKCE', {
        error: pkceError,
      });
    });
  });
});
