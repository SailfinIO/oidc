// src/clients/IUserInfoClient.ts

import { IUserInfo } from '../interfaces/IUserInfo';

export interface IUserInfoClient {
  /**
   * Retrieves user information from the UserInfo endpoint.
   *
   * @returns {Promise<IUserInfo>} The user information.
   * @throws {ClientError} If fetching user info fails or no valid access token is available.
   */
  getUserInfo(): Promise<IUserInfo>;
}
