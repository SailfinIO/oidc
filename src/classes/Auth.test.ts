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
} from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { buildLogoutUrl, sleep, parseFragment } from '../utils';
import { PkceMethod, Scopes, GrantType } from '../enums';
import { JwtValidator } from './JwtValidator';

// Mock utilities
jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  sleep: jest.fn(), // Mock the sleep function
  generateRandomString: jest.fn(), // Mock generateRandomString
  parseFragment: jest.fn(), // Mock parseFragment
  buildAuthorizationUrl: jest.fn(),
  buildLogoutUrl: jest.fn(),
}));

describe('Auth', () => {
  let mockIssuer: jest.Mocked<IIssuer>;
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

    // Mock fetch globally
    global.fetch = jest.fn();

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
      auth = new Auth(config, mockLogger, mockIssuer, mockTokenClient);
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

          (global.fetch as jest.Mock).mockResolvedValueOnce(
            new Response(JSON.stringify(deviceResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );

          const result = await auth.startDeviceAuthorization();

          expect(mockIssuer.discover).toHaveBeenCalledTimes(1);
          expect(global.fetch).toHaveBeenCalledWith(deviceEndpoint, {
            method: 'POST',
            body: expect.stringContaining(
              `client_id=${encodeURIComponent(config.clientId)}`,
            ),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
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
            (global.fetch as jest.Mock).mockRejectedValueOnce(mockError);

            await expect(
              auth.pollDeviceToken(device_code, 5, 10000),
            ).rejects.toThrow(ClientError);

            expect(global.fetch).toHaveBeenCalledTimes(1);

            const expectedParams = new URLSearchParams({
              grant_type: GrantType.DeviceCode,
              device_code: device_code,
              client_id: config.clientId,
            });

            expect(global.fetch).toHaveBeenCalledWith(tokenEndpoint!, {
              method: 'POST',
              body: expectedParams.toString(),
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

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
            (global.fetch as jest.Mock).mockRejectedValueOnce(unexpectedError);

            const pollPromise = auth.pollDeviceToken(device_code, 5, 10000);

            // First poll: unexpected error, method should throw immediately
            await expect(pollPromise).rejects.toThrow(ClientError);

            expect(global.fetch).toHaveBeenCalledTimes(1);
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

            (global.fetch as jest.Mock).mockResolvedValueOnce(
              new Response(JSON.stringify(tokenResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );

            const pollPromise = auth.pollDeviceToken(device_code, 5, 10000);

            // Fast-forward until all timers have been executed
            jest.runAllTimers();

            await pollPromise;

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledWith(tokenEndpoint!, {
              method: 'POST',
              body: expect.stringContaining(
                `grant_type=${encodeURIComponent(GrantType.DeviceCode)}`,
              ),
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
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
            endSessionEndpoint: mockClientMetadata.end_session_endpoint!,
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
            endSessionEndpoint: mockClientMetadata.end_session_endpoint!,
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
          // Mock generateRandomString to return predictable values
          const utils = require('../utils');
          (utils.generateRandomString as jest.Mock)
            .mockReturnValueOnce('state123')
            .mockReturnValueOnce('nonce123');

          // No need to mock generateAuthUrl; let it execute normally

          const buildAuthorizationUrlSpy = jest
            .spyOn(require('../utils'), 'buildAuthorizationUrl')
            .mockReturnValue(
              'https://example.com/oauth2/authorize?client_id=test-client-id',
            );

          const result = await auth.getAuthorizationUrl();

          expect(result.url).toEqual(
            expect.stringContaining(
              `client_id=${encodeURIComponent(config.clientId)}`,
            ),
          );
          expect(mockLogger.debug).toHaveBeenCalledWith(
            'Authorization URL generated',
            {
              url: result.url,
            },
          );

          // Restore the original implementation
          buildAuthorizationUrlSpy.mockRestore();
        });

        it('should generate an authorization URL without PKCE', async () => {
          // Modify config to disable PKCE
          config.pkce = false;

          // Mock generateRandomString to return predictable values
          const utils = require('../utils');
          (utils.generateRandomString as jest.Mock)
            .mockReturnValueOnce('state123')
            .mockReturnValueOnce('nonce123');

          // No need to mock generateAuthUrl; let it execute normally

          const buildAuthorizationUrlSpy = jest
            .spyOn(require('../utils'), 'buildAuthorizationUrl')
            .mockReturnValue(
              'https://example.com/oauth2/authorize?client_id=test-client-id',
            );

          const result = await auth.getAuthorizationUrl();

          expect(result.url).toEqual(
            expect.stringContaining(
              `client_id=${encodeURIComponent(config.clientId)}`,
            ),
          );
          expect(mockLogger.debug).toHaveBeenCalledWith(
            'Authorization URL generated',
            {
              url: result.url,
            },
          );

          // Restore the original implementation
          buildAuthorizationUrlSpy.mockRestore();
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

      describe('handleRedirect', () => {
        let authInstance: IAuth;
        let configInstance: IClientConfig;

        beforeEach(() => {
          configInstance = {
            clientId: 'test-client-id',
            redirectUri: 'https://example.com/callback',
            scopes: [Scopes.OpenId, Scopes.Profile],
            discoveryUrl:
              'https://example.com/.well-known/openid-configuration',
            grantType: GrantType.AuthorizationCode,
            pkce: true,
            pkceMethod: PkceMethod.S256,
            postLogoutRedirectUri: 'https://example.com/logout-callback',
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
            mockClientMetadata as ClientMetadata,
          );

          // create Jwt Payload
          const jwtPayload = {
            sub: '12345',
            iss: 'https://example.com/',
            aud: 'test-client-id',
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
            // @ts-ignore // Private method
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
          // @ts-ignore // Private method
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
          // @ts-ignore // Private method
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
            mockClientMetadata as ClientMetadata,
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
    }
  });

  describe('handleRedirectForImplicitFlow', () => {
    beforeEach(() => {
      config = {
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        scopes: [Scopes.OpenId, Scopes.Profile],
        discoveryUrl: 'https://example.com/.well-known/openid-configuration',
        grantType: GrantType.Implicit,
        pkce: false, // PKCE is typically not used with Implicit flow
        postLogoutRedirectUri: 'https://example.com/logout-callback',
      };
      auth = new Auth(config, mockLogger, mockIssuer, mockTokenClient);
    });

    it('should handle redirect successfully with id_token', async () => {
      const fragment =
        '#access_token=access-token&id_token=id-token&state=valid-state&token_type=Bearer&expires_in=3600';

      // Mock parseFragment to parse the fragment correctly
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
        mockClientMetadata as ClientMetadata,
      );

      // Spy on JwtValidator.prototype.validateIdToken
      const validateIdTokenMock = jest
        .spyOn(JwtValidator.prototype, 'validateIdToken')
        .mockResolvedValueOnce({
          sub: '12345',
          iss: 'https://example.com/',
          aud: 'test-client-id',
          nonce: 'expected-nonce',
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

      // Call the method
      await auth.handleRedirectForImplicitFlow(fragment);

      // Assertions
      expect(parseFragment).toHaveBeenCalledWith(fragment);
      expect((auth as Auth)['state'].getNonce).toHaveBeenCalledWith(
        'valid-state',
      );
      expect(mockIssuer.discover).toHaveBeenCalledTimes(1);
      expect(validateIdTokenMock).toHaveBeenCalledWith(
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

      // Mock parseFragment to parse the fragment correctly
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

      // Call the method
      await auth.handleRedirectForImplicitFlow(fragment);

      // Assertions
      expect(parseFragment).toHaveBeenCalledWith(fragment);
      expect((auth as Auth)['state'].getNonce).toHaveBeenCalledWith(
        'valid-state',
      );
      expect(mockIssuer.discover).not.toHaveBeenCalled(); // No id_token, so no discovery
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

      // Mock parseFragment to parse the fragment correctly
      (parseFragment as jest.Mock).mockReturnValue({
        error: 'access_denied',
        error_description: 'User denied access',
      });

      // Call the method and expect an error
      await expect(
        auth.handleRedirectForImplicitFlow(fragment),
      ).rejects.toThrow(ClientError);

      // Assertions
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

      // Mock parseFragment to parse the fragment correctly
      (parseFragment as jest.Mock).mockReturnValue({
        id_token: 'id-token',
        state: 'valid-state',
        token_type: 'Bearer',
        expires_in: '3600',
      });

      // Call the method and expect an error
      await expect(
        auth.handleRedirectForImplicitFlow(fragment),
      ).rejects.toThrow(ClientError);

      // Assertions
      expect(parseFragment).toHaveBeenCalledWith(fragment);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Error due to missing access_token is thrown before logging
    });

    it('should throw ClientError if state is missing', async () => {
      const fragment =
        '#access_token=access-token&id_token=id-token&token_type=Bearer&expires_in=3600';

      // Mock parseFragment to parse the fragment correctly
      (parseFragment as jest.Mock).mockReturnValue({
        access_token: 'access-token',
        id_token: 'id-token',
        token_type: 'Bearer',
        expires_in: '3600',
      });

      // Call the method and expect an error
      await expect(
        auth.handleRedirectForImplicitFlow(fragment),
      ).rejects.toThrow(ClientError);

      // Assertions
      expect(parseFragment).toHaveBeenCalledWith(fragment);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Error due to missing state is thrown before logging
    });

    it('should throw ClientError if state does not match any stored state', async () => {
      const fragment =
        '#access_token=access-token&id_token=id-token&state=invalid-state&token_type=Bearer&expires_in=3600';

      // Mock parseFragment to parse the fragment correctly
      (parseFragment as jest.Mock).mockReturnValue({
        access_token: 'access-token',
        id_token: 'id-token',
        state: 'invalid-state',
        token_type: 'Bearer',
        expires_in: '3600',
      });

      // Mock state retrieval to return null for the invalid state
      jest.spyOn((auth as Auth)['state'], 'getNonce').mockResolvedValue(null);

      // Call the method and expect an error
      await expect(
        auth.handleRedirectForImplicitFlow(fragment),
      ).rejects.toThrow(ClientError);

      // Assertions
      expect(parseFragment).toHaveBeenCalledWith(fragment);
      expect((auth as Auth)['state'].getNonce).toHaveBeenCalledWith(
        'invalid-state',
      );
      expect(mockLogger.error).not.toHaveBeenCalled(); // Error due to state mismatch is thrown before logging
    });
  });
});
