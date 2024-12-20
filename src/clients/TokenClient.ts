// src/token/TokenManager.ts

import {
  IClientConfig,
  ITokenResponse,
  ITokenIntrospectionResponse,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { Logger, buildUrlEncodedBody } from '../utils';
import { HTTPClient } from './HTTPClient';
import { DiscoveryClient } from './DiscoveryClient';
import { GrantType } from '../enums/GrantType';

export class TokenClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private idToken: string | null = null;
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
    if (tokenResponse.id_token) {
      // Store it for later validation
      this.idToken = tokenResponse.id_token;
    }
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
    const now = Date.now();
    const threshold = (this.config.tokenRefreshThreshold || 60) * 1000; // default 60 seconds
    return now < this.expiresAt - threshold;
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

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const body = buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(tokenEndpoint, body, headers);
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

  public getTokens(): ITokenResponse | null {
    if (!this.accessToken) {
      return null;
    }
    return {
      access_token: this.accessToken,
      refresh_token: this.refreshToken || undefined,
      expires_in: this.expiresAt
        ? (this.expiresAt - Date.now()) / 1000
        : undefined,
      token_type: 'Bearer',
      id_token: this.idToken,
    };
  }

  public clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.idToken = null;
    this.expiresAt = null;
    this.logger.debug('All stored tokens have been cleared');
  }

  /**
   * Introspect a token using the introspection endpoint.
   * @param token The access or refresh token to introspect.
   * @returns Introspection response with active = true/false and other claims if active.
   */
  public async introspectToken(
    token: string,
  ): Promise<ITokenIntrospectionResponse> {
    const discoveryConfig = await this.discoveryClient.fetchDiscoveryConfig();
    if (!discoveryConfig.introspection_endpoint) {
      throw new ClientError(
        'No introspection endpoint available',
        'INTROSPECTION_UNSUPPORTED',
      );
    }

    const params: Record<string, string> = {
      token,
      client_id: this.config.clientId,
    };

    if (this.config.clientSecret) {
      params.client_secret = this.config.clientSecret;
    }

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const body = buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(
        discoveryConfig.introspection_endpoint,
        body,
        headers,
      );
      const introspectionResult: ITokenIntrospectionResponse =
        JSON.parse(response);
      this.logger.debug('Token introspected successfully', {
        introspectionResult,
      });
      return introspectionResult;
    } catch (error) {
      this.logger.error('Token introspection failed', { error });
      throw new ClientError(
        'Token introspection failed',
        'INTROSPECTION_ERROR',
        { originalError: error },
      );
    }
  }

  /**
   * Revoke a token using the revocation endpoint.
   * @param token The access or refresh token to revoke.
   * @param tokenTypeHint Optional hint about the type of token: 'refresh_token' or 'access_token'.
   */
  public async revokeToken(
    token: string,
    tokenTypeHint?: 'refresh_token' | 'access_token',
  ): Promise<void> {
    const discoveryConfig = await this.discoveryClient.fetchDiscoveryConfig();
    if (!discoveryConfig.revocation_endpoint) {
      throw new ClientError(
        'No revocation endpoint available',
        'REVOCATION_UNSUPPORTED',
      );
    }

    const params: Record<string, string> = {
      token,
      client_id: this.config.clientId,
    };

    if (this.config.clientSecret) {
      params.client_secret = this.config.clientSecret;
    }

    if (tokenTypeHint) {
      params.token_type_hint = tokenTypeHint;
    }

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const body = buildUrlEncodedBody(params);

    try {
      await this.httpClient.post(
        discoveryConfig.revocation_endpoint,
        body,
        headers,
      );
      this.logger.info('Token revoked successfully');
      // If this is the currently stored token, consider clearing them
      if (token === this.accessToken || token === this.refreshToken) {
        this.clearTokens();
      }
    } catch (error) {
      this.logger.error('Token revocation failed', { error });
      throw new ClientError('Token revocation failed', 'REVOCATION_ERROR', {
        originalError: error,
      });
    }
  }
}
