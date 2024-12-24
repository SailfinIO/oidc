// src/clients/UserInfoClient.test.ts

import { UserInfo } from './UserInfo';
import {
  IUserInfo,
  IUser,
  IHttp,
  ILogger,
  IToken,
  ClientMetadata,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';

describe('UserInfoClient', () => {
  let userInfoClient: IUserInfo;
  let mockTokenClient: jest.Mocked<IToken>;
  let mockDiscoveryConfig: Partial<ClientMetadata>;
  let mockHttpClient: jest.Mocked<IHttp>;
  let mockLogger: jest.Mocked<ILogger>;

  const userInfoEndpoint = 'https://example.com/userinfo';
  const sampleUserInfo: IUser = {
    sub: 'user123',
    name: 'John Doe',
    email: 'john.doe@example.com',
    // Add other user info fields as necessary
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
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

    mockDiscoveryConfig = {
      issuer: 'https://example.com/',
      authorization_endpoint: 'https://example.com/oauth2/authorize',
      token_endpoint: 'https://example.com/oauth2/token',
      userinfo_endpoint: userInfoEndpoint,
      jwks_uri: 'https://example.com/.well-known/jwks.json',
      // Add other fields as necessary
    };

    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      options: jest.fn(),
      head: jest.fn(),
      connect: jest.fn(),
      trace: jest.fn(),
    };

    userInfoClient = new UserInfo(
      mockTokenClient,
      mockDiscoveryConfig as ClientMetadata,
      mockHttpClient,
      mockLogger,
    );
  });

  describe('getUserInfo', () => {
    it('should fetch user info successfully when access token is available', async () => {
      // Arrange
      mockTokenClient.getAccessToken.mockResolvedValue('valid-access-token');
      mockHttpClient.get.mockResolvedValue(JSON.stringify(sampleUserInfo));

      // Act
      const userInfo = await userInfoClient.getUserInfo();

      // Assert
      expect(mockTokenClient.getAccessToken).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.get).toHaveBeenCalledWith(userInfoEndpoint, {
        Authorization: 'Bearer valid-access-token',
      });
      expect(userInfo).toEqual(sampleUserInfo);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Fetching user info from endpoint',
        {
          userInfoEndpoint,
        },
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Fetched user info successfully',
        {
          userInfo,
        },
      );
    });

    it('should throw ClientError with code "NO_ACCESS_TOKEN" if no access token is available', async () => {
      // Arrange
      mockTokenClient.getAccessToken.mockResolvedValue(null);

      // Act & Assert
      await expect(userInfoClient.getUserInfo()).rejects.toThrow(ClientError);
      await expect(userInfoClient.getUserInfo()).rejects.toMatchObject({
        message: 'No valid access token available',
        code: 'NO_ACCESS_TOKEN',
      });

      expect(mockTokenClient.getAccessToken).toHaveBeenCalledTimes(2); // Called twice due to two separate expect calls
      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No valid access token available when fetching user info',
      );
    });

    it('should throw ClientError with code "HTTP_GET_ERROR" if HTTP GET request fails', async () => {
      // Arrange
      mockTokenClient.getAccessToken.mockResolvedValue('valid-access-token');
      const mockError = new Error('Network Error');
      mockHttpClient.get.mockRejectedValue(mockError);

      // Act & Assert
      await expect(userInfoClient.getUserInfo()).rejects.toThrow(ClientError);
      await expect(userInfoClient.getUserInfo()).rejects.toMatchObject({
        message: 'Failed to fetch user info',
        code: 'HTTP_GET_ERROR',
      });

      expect(mockTokenClient.getAccessToken).toHaveBeenCalledTimes(2);
      expect(mockHttpClient.get).toHaveBeenCalledWith(userInfoEndpoint, {
        Authorization: 'Bearer valid-access-token',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Fetching user info from endpoint',
        {
          userInfoEndpoint,
        },
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to fetch user info',
        {
          error: mockError,
        },
      );
    });

    it('should throw ClientError with code "INVALID_JSON" if user info response is invalid JSON', async () => {
      // Arrange
      mockTokenClient.getAccessToken.mockResolvedValue('valid-access-token');
      mockHttpClient.get.mockResolvedValue('invalid-json');

      // Act & Assert
      await expect(userInfoClient.getUserInfo()).rejects.toThrow(ClientError);
      await expect(userInfoClient.getUserInfo()).rejects.toMatchObject({
        message: 'Invalid JSON response from user info endpoint',
        code: 'INVALID_JSON',
      });

      expect(mockTokenClient.getAccessToken).toHaveBeenCalledTimes(2);
      expect(mockHttpClient.get).toHaveBeenCalledWith(userInfoEndpoint, {
        Authorization: 'Bearer valid-access-token',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Fetching user info from endpoint',
        {
          userInfoEndpoint,
        },
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid JSON response from user info endpoint',
        {
          error: expect.any(SyntaxError),
        },
      );
    });
  });
});
