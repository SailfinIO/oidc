import { TokenClient } from './TokenClient';
import {
  ITokenClient,
  ILogger,
  IClientConfig,
  IDiscoveryClient,
  IHttpClient,
  ITokenResponse,
  ITokenIntrospectionResponse,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { GrantType, TokenTypeHint } from '../enums';

describe('TokenClient', () => {
  let tokenClient: ITokenClient;
  let mockLogger: ILogger;
  let mockConfig: IClientConfig;
  let mockDiscoveryClient: IDiscoveryClient;
  let mockHttpClient: IHttpClient;

  // Fixed timestamp for consistent testing (e.g., Jan 1, 2023 00:00:00 GMT)
  const fixedTimestamp = new Date('2023-01-01T00:00:00Z').getTime();

  // Variable to hold the current mocked time
  let currentTime: number;

  // Spy on Date.now()
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeAll(() => {
    // Initialize currentTime with fixedTimestamp
    currentTime = fixedTimestamp;

    // Mock Date.now() to return currentTime
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
  });

  afterAll(() => {
    // Restore the original Date.now() implementation
    dateNowSpy.mockRestore();
  });

  beforeEach(() => {
    mockLogger = {
      setLogLevel: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    mockConfig = {
      clientId: 'test-client-id',
      redirectUri: 'https://example.com/callback',
      scopes: ['openid', 'profile'],
      discoveryUrl: 'https://example.com/.well-known/openid-configuration',
      tokenRefreshThreshold: 60,
      // No clientSecret provided
    };

    mockDiscoveryClient = {
      getDiscoveryConfig: jest.fn().mockResolvedValue({
        token_endpoint: 'https://example.com/oauth/token',
        introspection_endpoint: 'https://example.com/oauth/introspect',
        revocation_endpoint: 'https://example.com/oauth/revoke',
        // Add other necessary IDiscoveryConfig properties
      }),
    };

    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      trace: jest.fn(),
      connect: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
    };

    tokenClient = new TokenClient(
      mockLogger,
      mockConfig,
      mockDiscoveryClient,
      mockHttpClient,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper function to advance the mocked current time
   * @param ms Number of milliseconds to advance
   */
  const advanceTimeBy = (ms: number) => {
    currentTime += ms;
  };

  describe('refreshAccessToken', () => {
    it('should refresh the access token successfully', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'old-access-token',
        refresh_token: 'valid-refresh-token',
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
      });

      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
      };

      (mockHttpClient.post as jest.Mock).mockResolvedValue(
        JSON.stringify(mockTokenResponse),
      );

      // Act
      await tokenClient.refreshAccessToken();

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        'grant_type=refresh_token&refresh_token=valid-refresh-token&client_id=test-client-id',
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Access token refreshed successfully',
      );

      const tokens = tokenClient.getTokens();
      expect(tokens).toMatchObject({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
      });
      expect(tokens?.expires_in).toBe(3600);
    });

    it('should throw an error if no refresh token is available', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'old-access-token',
        token_type: 'Bearer',
      });

      // Act & Assert
      await expect(tokenClient.refreshAccessToken()).rejects.toThrow(
        ClientError,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to refresh access token',
        expect.any(ClientError),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'old-access-token',
        refresh_token: 'invalid-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      const mockError = new ClientError('HTTP Error', 'HTTP_ERROR');
      (mockHttpClient.post as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(tokenClient.refreshAccessToken()).rejects.toThrow(
        ClientError,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to refresh access token',
        mockError,
      );
    });
  });

  describe('setTokens', () => {
    it('should set all tokens correctly when all fields are provided', () => {
      const tokenResponse: ITokenResponse = {
        access_token: 'access123',
        refresh_token: 'refresh123',
        expires_in: 3600,
        token_type: 'Bearer',
        id_token: 'id123',
      };

      tokenClient.setTokens(tokenResponse);

      const tokens = tokenClient.getTokens();
      expect(tokens).toMatchObject({
        access_token: 'access123',
        refresh_token: 'refresh123',
        token_type: 'Bearer',
        id_token: 'id123',
      });
      expect(tokens?.expires_in).toBe(3600);
      expect(mockLogger.debug).toHaveBeenCalledWith('Tokens set successfully', {
        tokenResponse,
      });
    });

    it('should set tokens correctly without a refresh token', () => {
      const tokenResponse: ITokenResponse = {
        access_token: 'access123',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      tokenClient.setTokens(tokenResponse);

      const tokens = tokenClient.getTokens();
      expect(tokens).toMatchObject({
        access_token: 'access123',
        token_type: 'Bearer',
      });
      expect(tokens?.refresh_token).toBeUndefined();
      expect(tokens?.expires_in).toBe(3600);
      expect(mockLogger.debug).toHaveBeenCalledWith('Tokens set successfully', {
        tokenResponse,
      });
    });

    it('should set tokens correctly without an ID token', () => {
      const tokenResponse: ITokenResponse = {
        access_token: 'access123',
        refresh_token: 'refresh123',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      tokenClient.setTokens(tokenResponse);

      const tokens = tokenClient.getTokens();
      expect(tokens).toMatchObject({
        access_token: 'access123',
        refresh_token: 'refresh123',
        token_type: 'Bearer',
      });
      expect(tokens?.id_token).toBeUndefined(); // Updated expectation
      expect(tokens?.expires_in).toBe(3600);
      expect(mockLogger.debug).toHaveBeenCalledWith('Tokens set successfully', {
        tokenResponse,
      });
    });
  });

  describe('getAccessToken', () => {
    it('should return the access token if it is valid', async () => {
      tokenClient.setTokens({
        access_token: 'valid-access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600, // Token valid for 1 hour
        token_type: 'Bearer',
      });

      const accessToken = await tokenClient.getAccessToken();
      expect(accessToken).toBe('valid-access-token');
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });

    it('should refresh the access token if it is expired and refresh token is available', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'expired-access-token',
        refresh_token: 'valid-refresh-token',
        expires_in: 3600, // Expires in 1 hour from fixedTimestamp
        token_type: 'Bearer',
      });

      // Advance time by 4000 * 1000 ms (4000 seconds = 1 hour 6 minutes 40 seconds)
      advanceTimeBy(4000 * 1000);

      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (mockHttpClient.post as jest.Mock).mockResolvedValue(
        JSON.stringify(mockTokenResponse),
      );

      // Act
      const accessToken = await tokenClient.getAccessToken();

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        'grant_type=refresh_token&refresh_token=valid-refresh-token&client_id=test-client-id',
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Access token refreshed successfully',
      );
      expect(accessToken).toBe('new-access-token');
    });

    it('should return null if access token is expired and no refresh token is available', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'expired-access-token',
        token_type: 'Bearer',
        expires_in: 3600, // Expires in 1 hour from fixedTimestamp
      });

      // Advance time by 4000 * 1000 ms (4000 seconds = 1 hour 6 minutes 40 seconds)
      advanceTimeBy(4000 * 1000);

      // Act
      const accessToken = await tokenClient.getAccessToken();

      // Assert
      expect(accessToken).toBeNull();
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });
  });

  describe('isTokenValid', () => {
    it('should return true if no expiration time is set', () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'access-token',
        token_type: 'Bearer',
        // No expires_in provided
      });

      // Act
      // @ts-ignore
      const isValid = tokenClient.isTokenValid();

      // Assert
      expect(isValid).toBe(true);
    });

    it('should return true if the token is not expired', () => {
      tokenClient.setTokens({
        access_token: 'valid-access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600, // Token valid for 1 hour from fixedTimestamp
        token_type: 'Bearer',
      });

      // Act
      // @ts-ignore
      const isValid = tokenClient.isTokenValid();

      // Assert
      expect(isValid).toBe(true);
    });

    it('should return false if the token is expired', () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'expired-access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600, // Expires in 1 hour from fixedTimestamp
        token_type: 'Bearer',
      });

      // Advance time by 3600 * 1000 + 1000 ms (1 hour and 1 second)
      advanceTimeBy(3600 * 1000 + 1000);

      // Act
      // @ts-ignore
      const isValid = tokenClient.isTokenValid();

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('introspectToken', () => {
    it('should successfully introspect an active token', async () => {
      const token = 'active-token';
      const mockIntrospectionResponse: ITokenIntrospectionResponse = {
        active: true,
        scope: 'openid profile',
        client_id: 'test-client-id',
        username: 'user123',
        token_type: 'Bearer',
        exp: 3600,
        // other claims...
      };

      (mockHttpClient.post as jest.Mock).mockResolvedValue(
        JSON.stringify(mockIntrospectionResponse),
      );

      const result = await tokenClient.introspectToken(token);
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://example.com/oauth/introspect',
        'token=active-token&client_id=test-client-id',
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(result).toEqual(mockIntrospectionResponse);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Token introspected successfully',
        { introspectionResult: mockIntrospectionResponse },
      );
    });

    it('should successfully introspect an inactive token', async () => {
      const token = 'inactive-token';
      const mockIntrospectionResponse: ITokenIntrospectionResponse = {
        active: false,
      };

      (mockHttpClient.post as jest.Mock).mockResolvedValue(
        JSON.stringify(mockIntrospectionResponse),
      );

      const result = await tokenClient.introspectToken(token);
      expect(result).toEqual(mockIntrospectionResponse);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Token introspected successfully',
        { introspectionResult: mockIntrospectionResponse },
      );
    });

    it('should throw an error if introspection endpoint is unavailable', async () => {
      // Mock discovery config without introspection endpoint
      (mockDiscoveryClient.getDiscoveryConfig as jest.Mock).mockResolvedValue({
        token_endpoint: 'https://example.com/oauth/token',
        // introspection_endpoint is missing
        revocation_endpoint: 'https://example.com/oauth/revoke',
      });

      await expect(tokenClient.introspectToken('some-token')).rejects.toThrow(
        ClientError,
      );

      // Since the error is thrown before any HTTP request, mockLogger.error is not called
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle HTTP errors during introspection gracefully', async () => {
      const token = 'error-token';
      const mockError = new Error('Network error');
      (mockHttpClient.post as jest.Mock).mockRejectedValue(mockError);

      await expect(tokenClient.introspectToken(token)).rejects.toThrow(
        ClientError,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Token introspection failed',
        { error: mockError },
      );
    });
  });

  describe('revokeToken', () => {
    it('should successfully revoke a token without a token type hint', async () => {
      const token = 'token-to-revoke';

      (mockHttpClient.post as jest.Mock).mockResolvedValue('{}'); // Return valid JSON

      await tokenClient.revokeToken(token);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://example.com/oauth/revoke',
        'token=token-to-revoke&client_id=test-client-id',
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token revoked successfully',
      );
    });

    it('should successfully revoke a token with a token type hint', async () => {
      const token = 'token-to-revoke';
      const tokenTypeHint = TokenTypeHint.REFRESH_TOKEN;

      (mockHttpClient.post as jest.Mock).mockResolvedValue('{}'); // Return valid JSON

      await tokenClient.revokeToken(token, tokenTypeHint);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://example.com/oauth/revoke',
        'token=token-to-revoke&client_id=test-client-id&token_type_hint=refresh_token',
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token revoked successfully',
      );
    });

    it('should throw an error if revocation endpoint is unavailable', async () => {
      // Mock discovery config without revocation endpoint
      (mockDiscoveryClient.getDiscoveryConfig as jest.Mock).mockResolvedValue({
        token_endpoint: 'https://example.com/oauth/token',
        introspection_endpoint: 'https://example.com/oauth/introspect',
        // revocation_endpoint is missing
      });

      await expect(tokenClient.revokeToken('some-token')).rejects.toThrow(
        ClientError,
      );

      // Since the error is thrown before any HTTP request, mockLogger.error is not called
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle HTTP errors during revocation gracefully', async () => {
      const token = 'error-token';
      const mockError = new Error('Network error');
      (mockHttpClient.post as jest.Mock).mockRejectedValue(mockError);

      await expect(tokenClient.revokeToken(token)).rejects.toThrow(ClientError);
      expect(mockLogger.error).toHaveBeenCalledWith('Token revocation failed', {
        error: mockError,
      });
    });

    it('should clear tokens if the revoked token matches the stored tokens', async () => {
      tokenClient.setTokens({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Mock successful revocation
      (mockHttpClient.post as jest.Mock).mockResolvedValue('{}');

      await tokenClient.revokeToken('access-token');

      expect(tokenClient.getTokens()).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token revoked successfully',
      );
    });

    it('should not clear tokens if the revoked token does not match the stored tokens', async () => {
      tokenClient.setTokens({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Mock successful revocation
      (mockHttpClient.post as jest.Mock).mockResolvedValue('{}');

      await tokenClient.revokeToken('different-token');

      const tokens = tokenClient.getTokens();
      expect(tokens).not.toBeNull();
      expect(tokens?.access_token).toBe('access-token');
      expect(tokens?.refresh_token).toBe('refresh-token');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token revoked successfully',
      );
    });
  });

  describe('performTokenRequest', () => {
    it('should perform a token request with correct parameters', async () => {
      const endpoint = 'https://example.com/oauth/token';
      const params = {
        grant_type: GrantType.RefreshToken,
        refresh_token: 'refresh-token',
        client_id: 'test-client-id',
      };
      const mockResponse = { access_token: 'new-access-token' };

      (mockHttpClient.post as jest.Mock).mockResolvedValue(
        JSON.stringify(mockResponse),
      );

      // @ts-ignore
      const response = await tokenClient.performTokenRequest(endpoint, params);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        endpoint,
        'grant_type=refresh_token&refresh_token=refresh-token&client_id=test-client-id',
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(response).toEqual(mockResponse);
    });

    it('should propagate errors from HTTP client', async () => {
      const endpoint = 'https://example.com/oauth/token';
      const params = {
        grant_type: GrantType.RefreshToken,
        refresh_token: 'refresh-token',
        client_id: 'test-client-id',
      };
      const mockError = new Error('Network error');

      (mockHttpClient.post as jest.Mock).mockRejectedValue(mockError);

      await expect(
        // @ts-ignore
        tokenClient.performTokenRequest(endpoint, params),
      ).rejects.toThrow(mockError);
    });
  });

  describe('getTokens', () => {
    it('should return the tokens when they are set', () => {
      tokenClient.setTokens({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        id_token: 'id-token',
      });

      const tokens = tokenClient.getTokens();
      expect(tokens).toMatchObject({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        id_token: 'id-token',
      });
      expect(tokens?.expires_in).toBe(3600);
    });

    it('should return null when no tokens are set', () => {
      const tokens = tokenClient.getTokens();
      expect(tokens).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('should clear all tokens', () => {
      tokenClient.setTokens({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        id_token: 'id-token',
      });

      tokenClient.clearTokens();

      const tokens = tokenClient.getTokens();
      expect(tokens).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'All stored tokens have been cleared',
      );
    });
  });
});
