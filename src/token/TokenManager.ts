// src/token/TokenManager.ts

import { IClientConfig, ITokenResponse } from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { Logger } from '../utils/Logger';
import { HTTPClient } from '../utils/HTTPClient';
import { DiscoveryClient } from '../clients/DiscoveryClient';
import { Helpers } from 'src/utils/Helpers';

export class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;
  private logger: Logger;
  private httpClient: HTTPClient;

  constructor(logger: Logger) {
    this.logger = logger;
    this.httpClient = new HTTPClient(this.logger);
  }

  public setTokens(tokenResponse: ITokenResponse): void {
    this.accessToken = tokenResponse.access_token;
    this.refreshToken = tokenResponse.refresh_token || null;
    this.expiresAt = tokenResponse.expires_in
      ? Date.now() + tokenResponse.expires_in * 1000
      : null;
    this.logger.debug('Tokens set successfully', { tokenResponse });
  }

  public async getAccessToken(config: IClientConfig): Promise<string | null> {
    if (this.accessToken && this.isTokenValid()) {
      return this.accessToken;
    }
    if (this.refreshToken) {
      await this.refreshAccessToken(config);
      return this.accessToken;
    }
    return null;
  }

  private isTokenValid(): boolean {
    if (!this.expiresAt) return true;
    return Date.now() < this.expiresAt;
  }

  public async refreshAccessToken(config: IClientConfig): Promise<void> {
    if (!this.refreshToken) {
      throw new ClientError('No refresh token available', 'NO_REFRESH_TOKEN');
    }

    const discoveryClient = new DiscoveryClient(
      config.discoveryUrl,
      this.logger,
    );
    const discoveryConfig = await discoveryClient.fetchDiscoveryConfig();
    const tokenEndpoint = discoveryConfig.token_endpoint;

    const params = {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret || '',
    };

    const body = Helpers.buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(tokenEndpoint, body);
      const tokenResponse: ITokenResponse = JSON.parse(response);
      this.setTokens(tokenResponse);
      this.logger.info('Access token refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh access token', error);
      throw new ClientError('Token refresh failed', 'TOKEN_REFRESH_ERROR');
    }
  }
}
