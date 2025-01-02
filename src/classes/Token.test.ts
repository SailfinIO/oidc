import { Token } from './Token';
import {
  IToken,
  ILogger,
  IClientConfig,
  IIssuer,
  ITokenResponse,
  ITokenIntrospectionResponse,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { GrantType, Scopes, TokenTypeHint } from '../enums';
import { Jwt } from './Jwt';

// Mock the Jwt class
jest.mock('./Jwt');

// Type the mocked Jwt class
const MockedJwt = Jwt as jest.MockedClass<typeof Jwt>;

global.fetch = jest.fn();

// Helper to mock successful fetch responses
const mockFetchSuccess = (data: any, status: number = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(data),
});

describe('TokenClient', () => {
  let tokenClient: IToken;
  let mockLogger: ILogger;
  let mockConfig: IClientConfig;
  let mockIssuer: IIssuer;

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
      scopes: [Scopes.OpenId, Scopes.Profile],
      discoveryUrl: 'https://example.com/.well-known/openid-configuration',
      tokenRefreshThreshold: 60,
      // No clientSecret provided
    };

    mockIssuer = {
      discover: jest.fn().mockResolvedValue({
        token_endpoint: 'https://example.com/oauth/token',
        introspection_endpoint: 'https://example.com/oauth/introspect',
        revocation_endpoint: 'https://example.com/oauth/revoke',
        // Add other necessary IDiscoveryConfig properties
      }),
    };
    (global.fetch as jest.Mock).mockReset();
    tokenClient = new Token(mockLogger, mockConfig, mockIssuer);

    MockedJwt.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
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

      const mockTokenResponse: ITokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
      };

      // Mock fetch to return the token response
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchSuccess(mockTokenResponse),
      );

      // Act
      await tokenClient.refreshAccessToken();

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        {
          method: 'POST',
          body: 'grant_type=refresh_token&refresh_token=valid-refresh-token&client_id=test-client-id',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
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

    it('should include client_secret in the token request if provided', async () => {
      // Arrange
      mockConfig.clientSecret = 'test-client-secret'; // Add clientSecret to mockConfig

      tokenClient.setTokens({
        access_token: 'old-access-token',
        refresh_token: 'valid-refresh-token',
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
      });

      const mockTokenResponse: ITokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
      };

      // Mock fetch to return the token response
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchSuccess(mockTokenResponse),
      );

      // Act
      await tokenClient.refreshAccessToken();

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        {
          method: 'POST',
          body: 'grant_type=refresh_token&refresh_token=valid-refresh-token&client_id=test-client-id&client_secret=test-client-secret',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
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

      const mockError = new ClientError(
        'Token request failed',
        'TOKEN_REQUEST_ERROR',
      );
      (global.fetch as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(tokenClient.refreshAccessToken()).rejects.toThrow(
        'Token refresh failed',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Token request failed', {
        endpoint: 'https://example.com/oauth/token',
        params: {
          grant_type: 'refresh_token',
          refresh_token: 'invalid-refresh-token',
          client_id: 'test-client-id',
        },
        error: mockError,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to refresh access token',
        expect.any(ClientError),
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
      expect(global.fetch as jest.Mock).not.toHaveBeenCalled();
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

      const mockTokenResponse: ITokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchSuccess(mockTokenResponse),
      );

      // Act
      const accessToken = await tokenClient.getAccessToken();

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        {
          method: 'POST',
          body: 'grant_type=refresh_token&refresh_token=valid-refresh-token&client_id=test-client-id',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
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
      expect(global.fetch as jest.Mock).not.toHaveBeenCalled();
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

      // Mock fetch to return the introspection response
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchSuccess(mockIntrospectionResponse),
      );

      const result = await tokenClient.introspectToken(token);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/introspect',
        {
          method: 'POST',
          body: 'token=active-token&client_id=test-client-id',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
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

      // Mock fetch to return the introspection response
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchSuccess(mockIntrospectionResponse),
      );

      const result = await tokenClient.introspectToken(token);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/introspect',
        {
          method: 'POST',
          body: 'token=inactive-token&client_id=test-client-id',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      expect(result).toEqual(mockIntrospectionResponse);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Token introspected successfully',
        { introspectionResult: mockIntrospectionResponse },
      );
    });

    it('should throw an error if introspection endpoint is unavailable', async () => {
      // Mock discovery config without introspection endpoint
      (mockIssuer.discover as jest.Mock).mockResolvedValue({
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
      const mockError = new ClientError(
        'Token request failed',
        'TOKEN_REQUEST_ERROR',
      );
      (global.fetch as jest.Mock).mockRejectedValue(mockError);

      await expect(tokenClient.introspectToken(token)).rejects.toThrow(
        'Token introspection failed',
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Token request failed', {
        endpoint: 'https://example.com/oauth/introspect',
        params: {
          token: 'error-token',
          client_id: 'test-client-id',
        },
        error: mockError,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Token introspection failed',
        {
          error: mockError,
        },
      );
    });
    describe('introspectToken with clientSecret', () => {
      beforeEach(() => {
        // Add clientSecret to the configuration
        mockConfig.clientSecret = 'test-client-secret';
        tokenClient = new Token(mockLogger, mockConfig, mockIssuer);
      });

      it('should include client_secret in the introspection request if provided', async () => {
        const token = 'active-token-with-secret';
        const mockIntrospectionResponse: ITokenIntrospectionResponse = {
          active: true,
          scope: 'openid profile',
          client_id: 'test-client-id',
          username: 'user123',
          token_type: 'Bearer',
          exp: 3600,
          // other claims...
        };

        // Mock fetch to return the introspection response
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          mockFetchSuccess(mockIntrospectionResponse),
        );

        const result = await tokenClient.introspectToken(token);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/oauth/introspect',
          {
            method: 'POST',
            body: 'token=active-token-with-secret&client_id=test-client-id&client_secret=test-client-secret',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        );
        expect(result).toEqual(mockIntrospectionResponse);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Token introspected successfully',
          { introspectionResult: mockIntrospectionResponse },
        );
      });
    });
  });

  describe('revokeToken', () => {
    describe('revokeToken with clientSecret', () => {
      beforeEach(() => {
        // Add clientSecret to the configuration
        mockConfig.clientSecret = 'test-client-secret';
        tokenClient = new Token(mockLogger, mockConfig, mockIssuer);
      });

      it('should include client_secret in the revocation request if provided', async () => {
        const token = 'token-to-revoke-with-secret';

        // Mock fetch to simulate successful revocation
        (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchSuccess({}));

        // Act
        await tokenClient.revokeToken(token);

        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/oauth/revoke',
          {
            method: 'POST',
            body: 'token=token-to-revoke-with-secret&client_id=test-client-id&client_secret=test-client-secret',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Token revoked successfully',
        );
      });

      it('should include client_secret and token_type_hint in the revocation request if provided', async () => {
        const token = 'token-to-revoke-with-secret-and-hint';
        const tokenTypeHint = TokenTypeHint.AccessToken;

        // Mock fetch to simulate successful revocation
        (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchSuccess({}));

        // Act
        await tokenClient.revokeToken(token, tokenTypeHint);

        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/oauth/revoke',
          {
            method: 'POST',
            body: 'token=token-to-revoke-with-secret-and-hint&client_id=test-client-id&client_secret=test-client-secret&token_type_hint=access_token',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Token revoked successfully',
        );
      });
    });

    it('should successfully revoke a token without a token type hint', async () => {
      const token = 'token-to-revoke';

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchSuccess({}));

      await tokenClient.revokeToken(token);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/revoke',
        {
          method: 'POST',
          body: 'token=token-to-revoke&client_id=test-client-id',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token revoked successfully',
      );
    });

    it('should successfully revoke a token with a token type hint', async () => {
      const token = 'token-to-revoke';
      const tokenTypeHint = TokenTypeHint.RefreshToken;

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchSuccess({}));

      await tokenClient.revokeToken(token, tokenTypeHint);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/revoke',
        {
          method: 'POST',
          body: 'token=token-to-revoke&client_id=test-client-id&token_type_hint=refresh_token',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token revoked successfully',
      );
    });

    it('should throw an error if revocation endpoint is unavailable', async () => {
      // Mock discovery config without revocation endpoint
      (mockIssuer.discover as jest.Mock).mockResolvedValue({
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
      const mockError = new ClientError(
        'Token request failed',
        'TOKEN_REQUEST_ERROR',
      );
      (global.fetch as jest.Mock).mockRejectedValue(mockError);

      await expect(tokenClient.revokeToken(token)).rejects.toThrow(ClientError);
      expect(mockLogger.error).toHaveBeenCalledWith('Token request failed', {
        endpoint: 'https://example.com/oauth/revoke',
        params: {
          token: 'error-token',
          client_id: 'test-client-id',
        },
        error: mockError,
      });
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
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchSuccess({}));

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
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchSuccess({}));

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

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchSuccess(mockResponse),
      );

      // @ts-ignore
      const response = await tokenClient.performTokenRequest(endpoint, params);

      expect(global.fetch).toHaveBeenCalledWith(endpoint, {
        method: 'POST',
        body: 'grant_type=refresh_token&refresh_token=refresh-token&client_id=test-client-id',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
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

      (global.fetch as jest.Mock).mockRejectedValue(mockError);

      await expect(
        // @ts-ignore
        tokenClient.performTokenRequest(endpoint, params),
      ).rejects.toThrow('Token request failed');
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

  describe('exchangeCodeForToken', () => {
    describe('exchangeCodeForToken with clientSecret', () => {
      beforeEach(() => {
        // Add clientSecret to the configuration
        mockConfig.clientSecret = 'test-client-secret';
        tokenClient = new Token(mockLogger, mockConfig, mockIssuer);
      });

      it('should include client_secret when exchanging code for token', async () => {
        // Arrange
        const code = 'auth-code-with-secret';
        const codeVerifier = 'code-verifier';
        const mockTokenResponse: ITokenResponse = {
          access_token: 'new-access-token-with-secret',
          refresh_token: 'new-refresh-token-with-secret',
          expires_in: 3600,
          token_type: 'Bearer',
        };
        mockConfig.grantType = GrantType.AuthorizationCode;

        // Mock fetch to return the token response
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          mockFetchSuccess(mockTokenResponse),
        );

        // Act
        await tokenClient.exchangeCodeForToken(code, codeVerifier);

        // Build expected body using URLSearchParams
        const expectedBody = new URLSearchParams({
          grant_type: GrantType.AuthorizationCode,
          client_id: 'test-client-id',
          redirect_uri: 'https://example.com/callback',
          client_secret: 'test-client-secret',
          code: code,
          code_verifier: codeVerifier,
        }).toString();

        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/oauth/token',
          {
            method: 'POST',
            body: expectedBody,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        );
        const tokens = tokenClient.getTokens();
        expect(tokens).toMatchObject({
          access_token: 'new-access-token-with-secret',
          refresh_token: 'new-refresh-token-with-secret',
          token_type: 'Bearer',
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Exchanged grant for tokens',
          {
            grantType: GrantType.AuthorizationCode,
          },
        );
      });
    });

    it('should exchange the authorization code for tokens successfully', async () => {
      // Arrange
      const code = 'auth-code';
      const codeVerifier = 'code-verifier';
      const mockTokenResponse: ITokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };
      mockConfig.grantType = GrantType.AuthorizationCode;

      // Mock fetch to return the token response
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchSuccess(mockTokenResponse),
      );

      // Act
      await tokenClient.exchangeCodeForToken(code, codeVerifier);

      // Build expected body using URLSearchParams
      const expectedBody = new URLSearchParams({
        grant_type: GrantType.AuthorizationCode,
        client_id: 'test-client-id',
        redirect_uri: 'https://example.com/callback',
        code: code,
        code_verifier: codeVerifier,
      }).toString();

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        {
          method: 'POST',
          body: expectedBody,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      const tokens = tokenClient.getTokens();
      expect(tokens).toMatchObject({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Exchanged grant for tokens',
        {
          grantType: GrantType.AuthorizationCode,
        },
      );
    });

    it('should handle errors during token exchange gracefully', async () => {
      // Arrange
      const code = 'auth-code';
      const codeVerifier = 'code-verifier';
      const mockError = new Error('Token exchange failed');

      // Set the grantType to AuthorizationCode
      mockConfig.grantType = GrantType.AuthorizationCode;

      // Mock the HTTP client's post method to reject with mockError
      (global.fetch as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        tokenClient.exchangeCodeForToken(code, codeVerifier),
      ).rejects.toThrow(ClientError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to exchange grant for tokens',
        expect.objectContaining({
          error: mockError,
          grantType: GrantType.AuthorizationCode,
        }),
      );
    });
  });

  describe('buildTokenRequestParams', () => {
    describe('buildTokenRequestParams with clientSecret', () => {
      beforeEach(() => {
        // Add clientSecret to the configuration
        mockConfig.clientSecret = 'test-client-secret';
        tokenClient = new Token(mockLogger, mockConfig, mockIssuer);
      });

      it('should include client_secret for Authorization Code grant type', () => {
        // Arrange
        const code = 'auth-code';
        const codeVerifier = 'code-verifier';
        mockConfig.grantType = GrantType.AuthorizationCode;

        // Act
        // @ts-ignore - testing private method
        const params = tokenClient.buildTokenRequestParams(code, codeVerifier);

        // Assert
        expect(params).toEqual({
          grant_type: GrantType.AuthorizationCode,
          client_id: 'test-client-id',
          redirect_uri: 'https://example.com/callback',
          client_secret: 'test-client-secret',
          code: 'auth-code',
          code_verifier: 'code-verifier',
        });
      });

      it('should include client_secret for Refresh Token grant type', () => {
        // Arrange
        const refreshToken = 'refresh-token';
        mockConfig.grantType = GrantType.RefreshToken;

        // Act
        // @ts-ignore - testing private method
        const params = tokenClient.buildTokenRequestParams(refreshToken);

        // Assert
        expect(params).toEqual({
          grant_type: GrantType.RefreshToken,
          client_id: 'test-client-id',
          redirect_uri: 'https://example.com/callback',
          client_secret: 'test-client-secret',
          refresh_token: 'refresh-token',
        });
      });

      // Add similar tests for other grant types if they utilize client_secret
    });

    it('should build correct parameters for Authorization Code grant type', () => {
      // Arrange
      const code = 'auth-code';
      const codeVerifier = 'code-verifier';
      mockConfig.grantType = GrantType.AuthorizationCode;

      // Act
      // @ts-ignore - testing private method
      const params = tokenClient.buildTokenRequestParams(code, codeVerifier);

      // Assert
      expect(params).toEqual({
        grant_type: GrantType.AuthorizationCode,
        client_id: 'test-client-id',
        redirect_uri: 'https://example.com/callback',
        code: 'auth-code',
        code_verifier: 'code-verifier',
      });
    });

    it('should build correct parameters for Device Code grant type', () => {
      // Arrange
      const code = 'device-code';
      mockConfig.grantType = GrantType.DeviceCode;

      // Act
      // @ts-ignore - testing private method
      const params = tokenClient.buildTokenRequestParams(code);

      // Assert
      expect(params).toEqual({
        grant_type: GrantType.DeviceCode,
        client_id: 'test-client-id',
        redirect_uri: 'https://example.com/callback',
        device_code: 'device-code',
      });
    });

    it('should build correct parameters for JWT Bearer grant type', () => {
      // Arrange
      const code = 'jwt-token';
      mockConfig.grantType = GrantType.JWTBearer;

      // Act
      // @ts-ignore - testing private method
      const params = tokenClient.buildTokenRequestParams(code);

      // Assert
      expect(params).toEqual({
        grant_type: GrantType.JWTBearer,
        client_id: 'test-client-id',
        redirect_uri: 'https://example.com/callback',
        assertion: 'jwt-token',
        scope: 'openid profile', // Based on mockConfig.scopes
      });
    });

    it('should build correct parameters for SAML2 Bearer grant type', () => {
      // Arrange
      const code = 'saml-token';
      mockConfig.grantType = GrantType.SAML2Bearer;

      // Act
      // @ts-ignore - testing private method
      const params = tokenClient.buildTokenRequestParams(code);

      // Assert
      expect(params).toEqual({
        grant_type: GrantType.SAML2Bearer,
        client_id: 'test-client-id',
        redirect_uri: 'https://example.com/callback',
        assertion: 'saml-token',
        scope: 'openid profile', // Based on mockConfig.scopes
      });
    });

    it('should handle Client Credentials grant type without errors', () => {
      // Arrange
      const code = 'client-credentials-code';
      mockConfig.grantType = GrantType.ClientCredentials;

      // Act
      // @ts-ignore - testing private method
      const params = tokenClient.buildTokenRequestParams(code);

      // Assert
      expect(params).toEqual({
        grant_type: GrantType.ClientCredentials,
        client_id: 'test-client-id',
        redirect_uri: 'https://example.com/callback',
      });
    });

    it('should handle Custom grant type without errors', () => {
      // Arrange
      const code = 'custom-grant-code';
      mockConfig.grantType = GrantType.Custom;

      // Act
      // @ts-ignore - testing private method
      const params = tokenClient.buildTokenRequestParams(code);

      // Assert
      expect(params).toEqual({
        grant_type: GrantType.Custom,
        client_id: 'test-client-id',
        redirect_uri: 'https://example.com/callback',
      });
    });

    it('should build correct parameters for Refresh Token grant type', () => {
      // Arrange
      const code = 'refresh-token';
      mockConfig.grantType = GrantType.RefreshToken;

      // Act
      // @ts-ignore - testing private method
      const params = tokenClient.buildTokenRequestParams(code);

      // Assert
      expect(params).toEqual({
        grant_type: GrantType.RefreshToken,
        client_id: 'test-client-id',
        redirect_uri: 'https://example.com/callback',
        refresh_token: 'refresh-token',
      });
    });

    it('should throw an error for unsupported grant types', () => {
      // Arrange
      const code = 'unsupported-code';
      mockConfig.grantType = 'unsupported_grant_type' as GrantType;

      // Act & Assert
      expect(() =>
        // @ts-ignore - testing private method
        tokenClient.buildTokenRequestParams(code),
      ).toThrowError(ClientError);
    });
  });

  describe('getClaims', () => {
    let mockJwtInstance: jest.Mocked<Jwt>;

    beforeEach(() => {
      // Reset Jwt mock before each test
      MockedJwt.mockClear();

      // Create a mocked instance of Jwt (if there are instance methods to mock)
      mockJwtInstance = {} as jest.Mocked<Jwt>;

      // Mock the constructor to return the mocked instance
      MockedJwt.mockImplementation(() => mockJwtInstance);

      // Mock the static verify method
      MockedJwt.verify = jest.fn();
    });

    it('should correctly identify and process a valid JWT access token', async () => {
      // Arrange
      const jwtToken = 'header.payload.signature'; // Simulated JWT token with three parts
      const jwtPayload = { sub: 'user123', name: 'John Doe' };

      // Mock JWT verification to return the payload
      (Jwt.verify as jest.Mock).mockResolvedValue(jwtPayload);

      tokenClient.setTokens({
        access_token: jwtToken,
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Act
      const claims = await tokenClient.getClaims();

      // Assert
      expect(claims).toEqual(jwtPayload);
      expect(Jwt.verify).toHaveBeenCalledWith(jwtToken, expect.any(Object));
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Claims extracted from JWT access token',
        { payload: jwtPayload },
      );
    });

    it('should correctly identify and process an opaque access token', async () => {
      // Arrange
      const opaqueToken = 'opaque.token'; // Simulated non-JWT token with less than three parts
      const userInfo = { sub: 'user123', email: 'john.doe@example.com' };

      tokenClient.setTokens({
        access_token: opaqueToken,
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Mock discovery with userinfo_endpoint
      (mockIssuer.discover as jest.Mock).mockResolvedValueOnce({
        token_endpoint: 'https://example.com/oauth/token',
        introspection_endpoint: 'https://example.com/oauth/introspect',
        revocation_endpoint: 'https://example.com/oauth/revoke',
        userinfo_endpoint: 'https://example.com/userinfo',
      });

      // Mock fetch to UserInfo endpoint
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(userInfo),
      });

      // Act
      const claims = await tokenClient.getClaims();

      // Assert
      expect(claims).toEqual(userInfo);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/userinfo',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${opaqueToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Access token is opaque; fetching claims from UserInfo endpoint',
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Claims fetched from UserInfo endpoint',
        { userInfo },
      );
    });

    it('should handle tokens with three parts but invalid JWT format gracefully', async () => {
      // Arrange
      const invalidJwtToken = 'part1.part2.part3';
      const verificationError = new Error('Invalid JWT format');

      // Mock JWT verification to throw an error
      (Jwt.verify as jest.Mock).mockRejectedValue(verificationError);

      tokenClient.setTokens({
        access_token: invalidJwtToken,
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Act & Assert
      await expect(tokenClient.getClaims()).rejects.toThrow(ClientError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to verify JWT access token',
        { error: verificationError },
      );
    });

    it('should throw a ClientError if JWT verification fails', async () => {
      // Arrange
      const verificationError = new Error('JWT verification failed');
      (Jwt.verify as jest.Mock).mockRejectedValue(verificationError);

      tokenClient.setTokens({
        access_token: 'invalid.jwt.token', // Simulate a JWT token
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Spy on the private isJwt method
      const isJwtSpy = jest
        .spyOn(tokenClient as any, 'isJwt')
        .mockReturnValue(true);

      // Act & Assert
      await expect(tokenClient.getClaims()).rejects.toThrow(ClientError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to verify JWT access token',
        {
          error: verificationError,
        },
      );

      // Restore the spy
      isJwtSpy.mockRestore();
    });

    it('should successfully fetch and return claims from UserInfo endpoint for opaque access token', async () => {
      // Arrange
      const userInfo = { sub: 'user123', email: 'john.doe@example.com' };
      // Simulate an opaque token (not a JWT)
      tokenClient.setTokens({
        access_token: 'opaque-access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Spy on the private isJwt method to return false
      const isJwtSpy = jest
        .spyOn(tokenClient as any, 'isJwt')
        .mockReturnValue(false);

      // Mock fetch to UserInfo endpoint
      const mockUserInfoEndpoint = 'https://example.com/userinfo';
      (mockIssuer.discover as jest.Mock).mockResolvedValueOnce({
        token_endpoint: 'https://example.com/oauth/token',
        introspection_endpoint: 'https://example.com/oauth/introspect',
        revocation_endpoint: 'https://example.com/oauth/revoke',
        userinfo_endpoint: mockUserInfoEndpoint,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(userInfo),
      });

      // Act
      const claims = await tokenClient.getClaims();

      // Assert
      expect(isJwtSpy).toHaveBeenCalledWith('opaque-access-token');
      expect(global.fetch).toHaveBeenCalledWith(mockUserInfoEndpoint, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer opaque-access-token',
          'Content-Type': 'application/json',
        },
      });
      expect(claims).toEqual(userInfo);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Access token is opaque; fetching claims from UserInfo endpoint',
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Claims fetched from UserInfo endpoint',
        { userInfo },
      );

      // Restore the spy
      isJwtSpy.mockRestore();
    });

    it('should throw a ClientError if UserInfo endpoint is unavailable for opaque access token', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'opaque-access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Spy on the private isJwt method to return false
      const isJwtSpy = jest
        .spyOn(tokenClient as any, 'isJwt')
        .mockReturnValue(false);

      // Mock discovery without userinfo_endpoint
      (mockIssuer.discover as jest.Mock).mockResolvedValueOnce({
        token_endpoint: 'https://example.com/oauth/token',
        introspection_endpoint: 'https://example.com/oauth/introspect',
        revocation_endpoint: 'https://example.com/oauth/revoke',
        // userinfo_endpoint is missing
      });

      // Act & Assert
      await expect(tokenClient.getClaims()).rejects.toThrow(ClientError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to fetch user info',
        {
          error: expect.any(ClientError),
        },
      );

      // Restore the spy
      isJwtSpy.mockRestore();
    });

    it('should throw a ClientError if fetching UserInfo fails', async () => {
      // Arrange
      const fetchError = new Error('Network error');
      tokenClient.setTokens({
        access_token: 'opaque-access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Spy on the private isJwt method to return false
      const isJwtSpy = jest
        .spyOn(tokenClient as any, 'isJwt')
        .mockReturnValue(false);

      // Mock discovery with userinfo_endpoint
      const mockUserInfoEndpoint = 'https://example.com/userinfo';
      (mockIssuer.discover as jest.Mock).mockResolvedValueOnce({
        token_endpoint: 'https://example.com/oauth/token',
        introspection_endpoint: 'https://example.com/oauth/introspect',
        revocation_endpoint: 'https://example.com/oauth/revoke',
        userinfo_endpoint: mockUserInfoEndpoint,
      });

      // Mock fetch to UserInfo endpoint to throw an error
      (global.fetch as jest.Mock).mockRejectedValueOnce(fetchError);

      // Act & Assert
      await expect(tokenClient.getClaims()).rejects.toThrow(ClientError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to fetch user info',
        {
          error: fetchError,
        },
      );

      // Restore the spy
      isJwtSpy.mockRestore();
    });

    it('should throw a ClientError if no access token is available', async () => {
      // Arrange
      tokenClient.clearTokens();

      // Act & Assert
      await expect(tokenClient.getClaims()).rejects.toThrow(ClientError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'No access token available',
        { error: expect.any(ClientError) },
      );
    });

    it('should refresh the access token if expired and then extract claims', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'expired-access-token',
        refresh_token: 'valid-refresh-token',
        expires_in: 3600, // Expires in 1 hour
        token_type: 'Bearer',
      });

      // Advance time to make the token expired
      advanceTimeBy(4000 * 1000); // Advance by more than the expiration time

      const mockTokenResponse: ITokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      // Mock refreshAccessToken
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchSuccess(mockTokenResponse),
      );

      // After refresh, set a valid JWT token
      const jwtPayload = { sub: 'user123', name: 'John Doe' };
      (Jwt.verify as jest.Mock).mockResolvedValue(jwtPayload);

      // Spy on the private isJwt method to return true after refresh
      const isJwtSpy = jest
        .spyOn(tokenClient as any, 'isJwt')
        .mockReturnValue(true);

      // Act
      const claims = await tokenClient.getClaims();

      // Assert
      // Expect refreshAccessToken to have been called internally
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        {
          method: 'POST',
          body: 'grant_type=refresh_token&refresh_token=valid-refresh-token&client_id=test-client-id',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Access token refreshed successfully',
      );
      expect(MockedJwt.verify).toHaveBeenCalledWith('new-access-token', {
        logger: mockLogger,
        client: await mockIssuer.discover(),
        clientId: mockConfig.clientId,
        jwks: undefined,
        claimsValidator: undefined,
        signatureVerifier: undefined,
        nonce: undefined,
      });
      expect(claims).toEqual(jwtPayload);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Claims extracted from JWT access token',
        { payload: jwtPayload },
      );

      // Restore the spy
      isJwtSpy.mockRestore();
    });
  });
});
