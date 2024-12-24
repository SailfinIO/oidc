// src/clients/UserInfo.ts

import {
  IUserInfo,
  IUser,
  IHttp,
  ILogger,
  IToken,
  ClientMetadata,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';

export class UserInfo implements IUserInfo {
  private tokenClient: IToken;
  private client: ClientMetadata;
  private httpClient: IHttp;
  private logger: ILogger;

  /**
   * Creates an instance of UserInfo.
   *
   * @param {IToken} tokenClient - The token client to retrieve access tokens.
   * @param {ClientMetadata} client - The discovery configuration containing the userinfo endpoint.
   * @param {IHttp} httpClient - The HTTP client for making requests.
   * @param {ILogger} logger - Logger instance for logging operations and errors.
   */
  constructor(
    tokenClient: IToken,
    client: ClientMetadata,
    httpClient: IHttp,
    logger: ILogger,
  ) {
    this.tokenClient = tokenClient;
    this.client = client;
    this.httpClient = httpClient;
    this.logger = logger;
  }

  /**
   * Retrieves user information from the UserInfo endpoint.
   *
   * @returns {Promise<IUser>} The user information.
   * @throws {ClientError} If fetching user info fails or no valid access token is available.
   */
  public async getUserInfo(): Promise<IUser> {
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

    const userInfoEndpoint = this.client.userinfo_endpoint;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    this.logger.debug('Fetching user info from endpoint', { userInfoEndpoint });

    try {
      const response = await this.httpClient.get(userInfoEndpoint, headers);
      let userInfo: IUser;
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