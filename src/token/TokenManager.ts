// src/token/TokenManager.ts

import { IClientConfig, ITokenResponse } from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { Logger } from '../utils/Logger';
import { HTTPClient } from '../utils/HTTPClient';
import { DiscoveryClient } from '../clients/DiscoveryClient';
import { Helpers } from '../utils/Helpers';
import { GrantType } from '../enums/GrantType';

export class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;
  private logger: Logger;
  private httpClient: HTTPClient;
  private config: IClientConfig;
  private discoveryClient: DiscoveryClient;

  constructor(logger: Logger, config: IClientConfig) {
    this.logger = logger;
    this.config = config;
    this.httpClient = new HTTPClient(this.logger);
    this.discoveryClient = new DiscoveryClient(
      this.config.discoveryUrl,
      this.logger,
    );
  }

  public setTokens(tokenResponse: ITokenResponse): void {
    this.accessToken = tokenResponse.access_token;
    this.refreshToken = tokenResponse.refresh_token || null;
    this.expiresAt = tokenResponse.expires_in
      ? Date.now() + tokenResponse.expires_in * 1000
      : null;
    this.logger.debug('Tokens set successfully', { tokenResponse });
  }

  public async getAccessToken(): Promise<string | null> {
    if (this.accessToken && this.isTokenValid()) {
      return this.accessToken;
    }
    if (this.refreshToken) {
      await this.refreshAccessToken();
      return this.accessToken;
    }
    return null;
  }

  private isTokenValid(): boolean {
    if (!this.expiresAt) return true;
    return Date.now() < this.expiresAt;
  }

  public async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new ClientError('No refresh token available', 'NO_REFRESH_TOKEN');
    }

    const discoveryConfig = await this.discoveryClient.fetchDiscoveryConfig();
    const tokenEndpoint = discoveryConfig.token_endpoint;

    const params: Record<string, string> = {
      grant_type: GrantType.RefreshToken,
      refresh_token: this.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret || '',
    };

    const body = Helpers.buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(tokenEndpoint, body);
      const tokenResponse: ITokenResponse = JSON.parse(response);
      this.setTokens(tokenResponse);
      this.logger.info('Access token refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh access token', error);
      throw new ClientError('Token refresh failed', 'TOKEN_REFRESH_ERROR', {
        originalError: error,
      });
    }
  }
}
