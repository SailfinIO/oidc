// src/clients/AuthClient.test.ts

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

describe('AuthClient', () => {
  let mockDiscoveryClient: jest.Mocked<IDiscoveryClient>;
  let mockHttpClient: jest.Mocked<IHttpClient>;
  let mockLogger: jest.Mocked<ILogger>;
  let mockTokenClient: jest.Mocked<ITokenClient>;
  let authClient: AuthClient;
  const config: IClientConfig = {
    clientId: 'test-client-id',
    redirectUri: 'https://example.com/callback',
    scopes: ['openid', 'profile'],
    discoveryUrl: 'https://example.com/.well-known/openid-configuration',
    grantType: GrantType.AuthorizationCode,
    pkce: true,
    pkceMethod: 'S256',
  };

  const mockDiscoveryConfig: IDiscoveryConfig = {
    issuer: 'https://example.com/',
    authorization_endpoint: 'https://example.com/oauth2/authorize',
    token_endpoint: 'https://example.com/oauth2/token',
    end_session_endpoint: 'https://example.com/oauth2/logout',
    jwks_uri: 'https://example.com/.well-known/jwks.json',
    userinfo_endpoint: 'https://example.com/oauth2/userinfo',
    // For Device Code
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

    // Mock TokenClient instantiation within AuthClient
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

    authClient = new AuthClient(
      config,
      mockLogger,
      mockDiscoveryClient,
      mockHttpClient,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance of AuthClient', () => {
      expect(authClient).toBeInstanceOf(AuthClient);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with PKCE when enabled', async () => {
      const state = 'test-state';
      const nonce = 'test-nonce';

      const result = await authClient.getAuthorizationUrl(state, nonce);

      expect(mockDiscoveryClient.getDiscoveryConfig).toHaveBeenCalledTimes(1);
      expect(result.url).toContain(mockDiscoveryConfig.authorization_endpoint);
      expect(result.codeVerifier).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Authorization URL generated',
        { url: result.url },
      );
    });

    it('should throw ClientError if grant type does not support authorization URLs', async () => {
      // Update config to unsupported grant type
      const unsupportedConfig: IClientConfig = {
        ...config,
        grantType: GrantType.ClientCredentials,
      };
      const unsupportedAuthClient = new AuthClient(
        unsupportedConfig,
        mockLogger,
        mockDiscoveryClient,
        mockHttpClient,
      );

      await expect(
        unsupportedAuthClient.getAuthorizationUrl('state'),
      ).rejects.toThrow(ClientError);
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Authorization URL generated'),
      );
    });

    it('should not include PKCE parameters when PKCE is disabled', async () => {
      const noPkceConfig: IClientConfig = { ...config, pkce: false };
      const noPkceAuthClient = new AuthClient(
        noPkceConfig,
        mockLogger,
        mockDiscoveryClient,
        mockHttpClient,
      );

      const state = 'test-state';
      const nonce = 'test-nonce';

      const result = await noPkceAuthClient.getAuthorizationUrl(state, nonce);

      expect(result.codeVerifier).toBeUndefined();
      expect(result.url).toContain('response_type=code');
      expect(noPkceAuthClient.getCodeVerifier()).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Authorization URL generated',
        { url: result.url },
      );
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange authorization code for tokens', async () => {
      const code = 'auth-code';
      const codeVerifier = 'code-verifier';

      const mockTokenResponse: ITokenResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      mockHttpClient.post.mockResolvedValue(JSON.stringify(mockTokenResponse));

      await authClient.exchangeCodeForToken(code, codeVerifier);

      expect(mockDiscoveryClient.getDiscoveryConfig).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        mockDiscoveryConfig.token_endpoint,
        expect.stringContaining(`grant_type=${GrantType.AuthorizationCode}`),
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(mockTokenClient.setTokens).toHaveBeenCalledWith(mockTokenResponse);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Exchanged grant for tokens',
        {
          grantType: config.grantType,
        },
      );
    });

    it('should handle errors during token exchange', async () => {
      const code = 'auth-code';
      const codeVerifier = 'code-verifier';

      const mockError = new Error('Token endpoint error');
      mockHttpClient.post.mockRejectedValue(mockError);

      await expect(
        authClient.exchangeCodeForToken(code, codeVerifier),
      ).rejects.toThrow(ClientError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to exchange grant for tokens',
        {
          error: mockError,
          grantType: config.grantType,
        },
      );
    });

    it('should include username and password for Password grant type', async () => {
      const passwordConfig: IClientConfig = {
        ...config,
        grantType: GrantType.Password,
      };
      const passwordAuthClient = new AuthClient(
        passwordConfig,
        mockLogger,
        mockDiscoveryClient,
        mockHttpClient,
      );
      const code = 'password-grant'; // In password grant, 'code' is not used; perhaps adjust
      const username = 'user';
      const password = 'pass';

      const mockTokenResponse: ITokenResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      mockHttpClient.post.mockResolvedValue(JSON.stringify(mockTokenResponse));

      await passwordAuthClient.exchangeCodeForToken(
        code,
        undefined,
        username,
        password,
      );

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        mockDiscoveryConfig.token_endpoint,
        expect.stringContaining(`grant_type=${GrantType.Password}`),
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(mockTokenClient.setTokens).toHaveBeenCalledWith(mockTokenResponse);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Exchanged grant for tokens',
        {
          grantType: passwordConfig.grantType,
        },
      );
    });

    it('should throw error if username or password is missing for Password grant type', async () => {
      const passwordConfig: IClientConfig = {
        ...config,
        grantType: GrantType.Password,
      };
      const passwordAuthClient = new AuthClient(
        passwordConfig,
        mockLogger,
        mockDiscoveryClient,
        mockHttpClient,
      );
      const code = 'password-grant';

      await expect(
        passwordAuthClient.exchangeCodeForToken(code),
      ).rejects.toThrow(ClientError);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('startDeviceAuthorization', () => {
    it('should initiate device authorization successfully', async () => {
      const config: IClientConfig = {
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        scopes: ['openid', 'profile'],
        discoveryUrl: 'https://example.com/.well-known/openid-configuration',
        grantType: GrantType.DeviceCode,
        pkce: true,
        pkceMethod: 'S256',
      };
      const deviceEndpoint = 'https://example.com/oauth2/device_authorize';
      const deviceResponse = {
        device_code: 'device-code',
        user_code: 'user-code',
        verification_uri: 'https://example.com/verify',
        expires_in: 1800,
        interval: 5,
      };

      authClient = new AuthClient(
        config,
        mockLogger,
        mockDiscoveryClient,
        mockHttpClient,
      );

      // Update discovery config to include device_authorization_endpoint
      const deviceDiscoveryConfig: IDiscoveryConfig = {
        ...mockDiscoveryConfig,
        device_authorization_endpoint: deviceEndpoint,
      };
      mockDiscoveryClient.getDiscoveryConfig.mockResolvedValueOnce(
        deviceDiscoveryConfig,
      );
      mockHttpClient.post.mockResolvedValueOnce(JSON.stringify(deviceResponse));

      const result = await authClient.startDeviceAuthorization();

      expect(mockDiscoveryClient.getDiscoveryConfig).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        deviceEndpoint,
        expect.stringContaining(`client_id=${config.clientId}`),
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(result).toEqual({
        device_code: deviceResponse.device_code,
        user_code: deviceResponse.user_code,
        verification_uri: deviceResponse.verification_uri,
        expires_in: deviceResponse.expires_in,
        interval: deviceResponse.interval,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Device authorization initiated',
      );
    });

    it('should throw ClientError if not using DeviceCode grant type', async () => {
      const unsupportedConfig: IClientConfig = {
        ...config,
        grantType: GrantType.ClientCredentials,
      };
      const unsupportedAuthClient = new AuthClient(
        unsupportedConfig,
        mockLogger,
        mockDiscoveryClient,
        mockHttpClient,
      );

      await expect(
        unsupportedAuthClient.startDeviceAuthorization(),
      ).rejects.toThrow(ClientError);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    // it('should throw ClientError if device_authorization_endpoint is missing', async () => {

    //   const incompleteDiscoveryConfig: IDiscoveryConfig = {
    //     ...mockDiscoveryConfig,
    //   };
    //   delete (incompleteDiscoveryConfig as any).device_authorization_endpoint;

    //   mockDiscoveryClient.getDiscoveryConfig.mockResolvedValueOnce(
    //     incompleteDiscoveryConfig,
    //   );

    //   await expect(authClient.startDeviceAuthorization()).rejects.toThrow(
    //     ClientError,
    //   );
    //   expect(mockLogger.error).toHaveBeenCalledWith(
    //     'Failed to start device authorization',
    //     { error: expect.any(Error) },
    //   );
    // });

    // it('should handle errors during device authorization initiation', async () => {
    //   const deviceEndpoint = 'https://example.com/oauth2/device_authorize';

    //   const deviceDiscoveryConfig: IDiscoveryConfig = {
    //     ...mockDiscoveryConfig,
    //     device_authorization_endpoint: deviceEndpoint,
    //   };
    //   mockDiscoveryClient.getDiscoveryConfig.mockResolvedValueOnce(
    //     deviceDiscoveryConfig,
    //   );
    //   const mockError = new Error('Device authorization failed');
    //   mockHttpClient.post.mockRejectedValueOnce(mockError);

    //   await expect(authClient.startDeviceAuthorization()).rejects.toThrow(
    //     ClientError,
    //   );
    //   expect(mockLogger.error).toHaveBeenCalledWith(
    //     'Failed to start device authorization',
    //     { error: mockError },
    //   );
    // });
  });

  // describe('pollDeviceToken', () => {
  //   beforeEach(() => {
  //     jest.useFakeTimers();
  //     jest.spyOn(global, 'setTimeout');
  //   });

  //   afterEach(() => {
  //     jest.useRealTimers();
  //   });

  //   it('should successfully poll and obtain tokens for DeviceCode grant', async () => {
  //     // Arrange
  //     const deviceConfig: IClientConfig = {
  //       ...config,
  //       grantType: GrantType.DeviceCode,
  //     };
  //     const deviceAuthClient = new AuthClient(
  //       deviceConfig,
  //       mockLogger,
  //       mockDiscoveryClient,
  //       mockHttpClient,
  //     );
  //     const device_code = 'device-code';
  //     const tokenEndpoint = mockDiscoveryConfig.token_endpoint;

  //     // Mock responses: first response is authorization_pending, then success
  //     mockHttpClient.post
  //       .mockRejectedValueOnce({
  //         context: { body: JSON.stringify({ error: 'authorization_pending' }) },
  //       })
  //       .mockResolvedValueOnce(
  //         JSON.stringify({
  //           access_token: 'new-access-token',
  //           refresh_token: 'new-refresh-token',
  //           expires_in: 3600,
  //           token_type: 'Bearer',
  //         }),
  //       );

  //     // Act
  //     const pollPromise = deviceAuthClient.pollDeviceToken(
  //       device_code,
  //       5,
  //       10000,
  //     );

  //     // First call: authorization_pending, schedule next poll
  //     expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  //     jest.advanceTimersByTime(5000);

  //     // Second call: tokens received
  //     await Promise.resolve(); // Allow any pending promises to resolve
  //     await pollPromise;

  //     // Assert
  //     expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
  //     expect(mockHttpClient.post).toHaveBeenNthCalledWith(
  //       1,
  //       tokenEndpoint,
  //       'grant_type=device_code&device_code=device-code&client_id=test-client-id',
  //       { 'Content-Type': 'application/x-www-form-urlencoded' },
  //     );
  //     expect(mockHttpClient.post).toHaveBeenNthCalledWith(
  //       2,
  //       tokenEndpoint,
  //       'grant_type=device_code&device_code=device-code&client_id=test-client-id',
  //       { 'Content-Type': 'application/x-www-form-urlencoded' },
  //     );
  //     expect(mockTokenClient.setTokens).toHaveBeenCalledWith({
  //       access_token: 'new-access-token',
  //       refresh_token: 'new-refresh-token',
  //       expires_in: 3600,
  //       token_type: 'Bearer',
  //     });
  //     expect(mockLogger.info).toHaveBeenCalledWith(
  //       'Device authorized and tokens obtained',
  //     );
  //   });

  //   it('should throw ClientError when grant type is not DeviceCode', async () => {
  //     const unsupportedConfig: IClientConfig = {
  //       ...config,
  //       grantType: GrantType.ClientCredentials,
  //     };
  //     const unsupportedAuthClient = new AuthClient(
  //       unsupportedConfig,
  //       mockLogger,
  //       mockDiscoveryClient,
  //       mockHttpClient,
  //     );

  //     const dummyDeviceCode = 'dummy-device-code'; // Add a dummy device code

  //     await expect(
  //       unsupportedAuthClient.pollDeviceToken(dummyDeviceCode), // Pass the dummy device code
  //     ).rejects.toThrow(ClientError);
  //     expect(mockLogger.debug).not.toHaveBeenCalledWith(
  //       expect.stringContaining('Authorization URL generated'),
  //     );
  //   });

  //   it('should handle slow_down error by increasing interval', async () => {
  //     const device_code = 'device-code';
  //     const tokenEndpoint = mockDiscoveryConfig.token_endpoint;

  //     // Mock responses: first response is slow_down, then success
  //     mockHttpClient.post
  //       .mockRejectedValueOnce({
  //         context: { body: JSON.stringify({ error: 'slow_down' }) },
  //       })
  //       .mockResolvedValueOnce(
  //         JSON.stringify({
  //           access_token: 'new-access-token',
  //           refresh_token: 'new-refresh-token',
  //           expires_in: 3600,
  //           token_type: 'Bearer',
  //         }),
  //       );

  //     const pollPromise = authClient.pollDeviceToken(device_code, 5, 20000);

  //     // First call: slow_down, increase interval to 10
  //     expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  //     jest.advanceTimersByTime(5000);

  //     // Second call: tokens received
  //     expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 10000);
  //     jest.advanceTimersByTime(10000);

  //     await pollPromise;

  //     expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
  //     expect(mockLogger.info).toHaveBeenCalledWith(
  //       'Device authorized and tokens obtained',
  //     );
  //   });

  //   it('should throw TIMEOUT_ERROR if polling exceeds timeout', async () => {
  //     const device_code = 'device-code';
  //     const tokenEndpoint = mockDiscoveryConfig.token_endpoint;

  //     // Mock responses: always authorization_pending
  //     mockHttpClient.post.mockRejectedValue({
  //       context: { body: JSON.stringify({ error: 'authorization_pending' }) },
  //     });

  //     const pollPromise = authClient.pollDeviceToken(device_code, 5, 15000);

  //     // First poll
  //     expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  //     jest.advanceTimersByTime(5000);

  //     // Second poll
  //     expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  //     jest.advanceTimersByTime(5000);

  //     // Third poll would exceed timeout
  //     jest.advanceTimersByTime(5000);

  //     await expect(pollPromise).rejects.toThrow(ClientError);
  //     expect(mockLogger.error).toHaveBeenCalledWith(
  //       'Device token polling timed out',
  //       'TIMEOUT_ERROR',
  //     );
  //   });

  //   it('should throw DEVICE_CODE_EXPIRED if expired_token is received', async () => {
  //     const device_code = 'device-code';
  //     const tokenEndpoint = mockDiscoveryConfig.token_endpoint;

  //     // Mock responses: first authorization_pending, then expired_token
  //     mockHttpClient.post
  //       .mockRejectedValueOnce({
  //         context: { body: JSON.stringify({ error: 'authorization_pending' }) },
  //       })
  //       .mockRejectedValueOnce({
  //         context: { body: JSON.stringify({ error: 'expired_token' }) },
  //       });

  //     const pollPromise = authClient.pollDeviceToken(device_code, 5, 20000);

  //     // First poll
  //     expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  //     jest.advanceTimersByTime(5000);

  //     // Second poll: expired_token
  //     expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  //     jest.advanceTimersByTime(5000);

  //     await expect(pollPromise).rejects.toThrow(ClientError);
  //     expect(mockLogger.error).toHaveBeenCalledWith(
  //       'Device token polling failed',
  //       {
  //         originalError: {
  //           context: { body: JSON.stringify({ error: 'expired_token' }) },
  //         },
  //       },
  //     );
  //   });

  //   it('should handle unexpected errors during polling', async () => {
  //     const device_code = 'device-code';
  //     const tokenEndpoint = mockDiscoveryConfig.token_endpoint;

  //     const unexpectedError = new Error('Unexpected error');
  //     mockHttpClient.post.mockRejectedValueOnce(unexpectedError);

  //     const pollPromise = authClient.pollDeviceToken(device_code, 5, 10000);

  //     // First poll
  //     expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
  //     jest.advanceTimersByTime(5000);

  //     await expect(pollPromise).rejects.toThrow(ClientError);
  //     expect(mockLogger.error).toHaveBeenCalledWith(
  //       'Device token polling failed',
  //       {
  //         originalError: unexpectedError,
  //       },
  //     );
  //   });
  // });

  describe('getLogoutUrl', () => {
    it('should generate logout URL with idTokenHint and state', async () => {
      const idTokenHint = 'id-token';
      const state = 'logout-state';
      const expectedLogoutUrl =
        'https://example.com/oauth2/logout?client_id=test-client-id&post_logout_redirect_uri=undefined&id_token_hint=id-token&state=logout-state';
      // Assuming buildLogoutUrl is deterministic and works correctly
      const result = await authClient.getLogoutUrl(idTokenHint, state);
      expect(mockDiscoveryClient.getDiscoveryConfig).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedLogoutUrl);
      expect(mockLogger.debug).toHaveBeenCalledWith('Logout URL generated', {
        logoutUrl: result,
      });
    });
    // it('should generate logout URL without idTokenHint and state', async () => {
    //   const expectedLogoutUrl =
    //     'https://example.com/oauth2/logout?client_id=test-client-id&post_logout_redirect_uri=https%3A%2F%2Fexample.com%2Fpost-logout';
    //   const result = await authClient.getLogoutUrl();
    //   expect(result).toBe(expectedLogoutUrl);
    //   expect(mockLogger.debug).toHaveBeenCalledWith('Logout URL generated', {
    //     logoutUrl: result,
    //   });
    // });
    // it('should throw ClientError if end_session_endpoint is missing', async () => {
    //   const incompleteDiscoveryConfig: IDiscoveryConfig = {
    //     ...mockDiscoveryConfig,
    //   };
    //   delete incompleteDiscoveryConfig.end_session_endpoint;
    //   mockDiscoveryClient.getDiscoveryConfig.mockResolvedValueOnce(
    //     incompleteDiscoveryConfig,
    //   );
    //   await expect(authClient.getLogoutUrl()).rejects.toThrow(ClientError);
    //   expect(mockLogger.error).toHaveBeenCalledWith(
    //     'Failed to generate logout URL',
    //     { error: expect.any(Error) },
    //   );
    // });
  });

  describe('getTokenManager', () => {
    it('should return the token client instance', () => {
      const tokenManager = authClient.getTokenManager();
      expect(tokenManager).toBeInstanceOf(TokenClient);
      // Further checks can verify it's the mocked instance
    });
  });
});
