// src/clients/TokenClient.ts

import {
  IClientConfig,
  ITokenResponse,
  ITokenIntrospectionResponse,
  IDiscoveryClient,
  ILogger,
  IHttpClient,
  ITokenClient,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { buildUrlEncodedBody } from '../utils';
import { GrantType } from '../enums/GrantType';
import { TokenTypeHint } from '../enums/TokenTypeHint';

export class TokenClient implements ITokenClient {
  private readonly logger: ILogger;
  private readonly httpClient: IHttpClient;
  private readonly config: IClientConfig;
  private readonly discoveryClient: IDiscoveryClient;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private idToken: string | null = null;
  private expiresAt: number | null = null;

  constructor(
    logger: ILogger,
    config: IClientConfig,
    discoveryClient: IDiscoveryClient,
    httpClient: IHttpClient,
  ) {
    this.logger = logger;
    this.config = config;
    this.httpClient = httpClient;
    this.discoveryClient = discoveryClient;
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
      const error = new ClientError(
        'No refresh token available',
        'NO_REFRESH_TOKEN',
      );
      this.logger.error('Failed to refresh access token', error);
      throw error;
    }

    const discoveryConfig = await this.discoveryClient.getDiscoveryConfig();
    const tokenEndpoint = discoveryConfig.token_endpoint;

    const params: Record<string, string> = {
      grant_type: GrantType.RefreshToken,
      refresh_token: this.refreshToken,
      client_id: this.config.clientId,
    };

    if (this.config.clientSecret) {
      params.client_secret = this.config.clientSecret;
    }

    try {
      const tokenResponse = await this.performTokenRequest(
        tokenEndpoint,
        params,
      );
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
        ? Math.floor((this.expiresAt - Date.now()) / 1000)
        : undefined,
      token_type: 'Bearer',
      id_token: this.idToken || undefined,
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
    const discoveryConfig = await this.discoveryClient.getDiscoveryConfig();
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

    try {
      const introspectionResult = await this.performTokenRequest(
        discoveryConfig.introspection_endpoint,
        params,
      );
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
    tokenTypeHint?: TokenTypeHint,
  ): Promise<void> {
    const discoveryConfig = await this.discoveryClient.getDiscoveryConfig();
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

    try {
      await this.performTokenRequest(
        discoveryConfig.revocation_endpoint,
        params,
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

  /**
   * Performs a token-related HTTP POST request.
   * @param endpoint The endpoint URL.
   * @param params The parameters to include in the request body.
   * @returns The parsed JSON response.
   */
  private async performTokenRequest(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<any> {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const body = buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(endpoint, body, headers);
      return JSON.parse(response);
    } catch (error) {
      // The calling method handles logging and throwing ClientError
      throw error;
    }
  }
}
