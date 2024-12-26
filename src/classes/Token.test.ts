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

global.fetch = jest.fn();

// Helper to mock successful fetch responses
const mockFetchSuccess = (data: any, status: number = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(data),
});

// Helper to mock failed fetch responses
const mockFetchFailure = (error: any) => {
  throw error;
};

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
  });

  describe('revokeToken', () => {
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
});
