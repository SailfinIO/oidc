// src/token/TokenManager.ts

import { ITokenResponse } from '../interfaces';
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

  public setTokens(tokenResponse: string): void {
    try {
      const tokens: ITokenResponse = JSON.parse(tokenResponse);
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token || null;
      this.expiresAt = tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : null;
      this.logger.debug('Tokens set successfully', { tokens });
    } catch (error) {
      this.logger.error('Failed to parse token response', error);
      throw new ClientError(
        'Invalid token response format',
        'TOKEN_PARSE_ERROR',
      );
    }
  }

  public getAccessToken(): string | null {
    if (this.accessToken && this.isTokenValid()) {
      return this.accessToken;
    }
    return null;
  }

  private isTokenValid(): boolean {
    if (!this.expiresAt) return true;
    return Date.now() < this.expiresAt;
  }

  public async refreshAccessToken(config: any): Promise<void> {
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
      this.setTokens(response);
      this.logger.info('Access token refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh access token', error);
      throw new ClientError('Token refresh failed', 'TOKEN_REFRESH_ERROR');
    }
  }
}
