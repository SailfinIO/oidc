// src/clients/UserInfoClient.ts

import {
  IUserInfoClient,
  IDiscoveryConfig,
  IUserInfo,
  IHttpClient,
  ILogger,
  ITokenClient,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';

export class UserInfoClient implements IUserInfoClient {
  private tokenClient: ITokenClient;
  private discoveryConfig: IDiscoveryConfig;
  private httpClient: IHttpClient;
  private logger: ILogger;

  /**
   * Creates an instance of UserInfoClient.
   *
   * @param {ITokenClient} tokenClient - The token client to retrieve access tokens.
   * @param {IDiscoveryConfig} discoveryConfig - The discovery configuration containing the userinfo endpoint.
   * @param {IHttpClient} httpClient - The HTTP client for making requests.
   * @param {ILogger} logger - Logger instance for logging operations and errors.
   */
  constructor(
    tokenClient: ITokenClient,
    discoveryConfig: IDiscoveryConfig,
    httpClient: IHttpClient,
    logger: ILogger,
  ) {
    this.tokenClient = tokenClient;
    this.discoveryConfig = discoveryConfig;
    this.httpClient = httpClient;
    this.logger = logger;
  }

  /**
   * Retrieves user information from the UserInfo endpoint.
   *
   * @returns {Promise<IUserInfo>} The user information.
   * @throws {ClientError} If fetching user info fails or no valid access token is available.
   */
  public async getUserInfo(): Promise<IUserInfo> {
    const accessToken = await this.tokenClient.getAccessToken();
    if (!accessToken) {
      this.logger.warn(
        'No valid access token available when fetching user info',
      );
      throw new ClientError(
        'No valid access token available',
        'NO_ACCESS_TOKEN',
      );
    }

    const userInfoEndpoint = this.discoveryConfig.userinfo_endpoint;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    this.logger.debug('Fetching user info from endpoint', { userInfoEndpoint });

    try {
      const response = await this.httpClient.get(userInfoEndpoint, headers);
      let userInfo: IUserInfo;
      try {
        userInfo = JSON.parse(response);
      } catch (parseError) {
        this.logger.error('Invalid JSON response from user info endpoint', {
          error: parseError,
        });
        throw new ClientError(
          'Invalid JSON response from user info endpoint',
          'INVALID_JSON',
          {
            originalError: parseError,
          },
        );
      }
      this.logger.debug('Fetched user info successfully', { userInfo });
      return userInfo;
    } catch (error: any) {
      if (error instanceof ClientError) {
        throw error; // Re-throw existing ClientErrors
      }
      this.logger.error('Failed to fetch user info', { error });
      throw new ClientError('Failed to fetch user info', 'HTTP_GET_ERROR', {
        originalError: error,
      });
    }
  }
}
