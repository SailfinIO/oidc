// src/classes/Token.ts

import {
  IClientConfig,
  TokenSet,
  ITokenIntrospectionResponse,
  IIssuer,
  ILogger,
  IToken,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { buildUrlEncodedBody } from '../utils';
import { GrantType } from '../enums/GrantType';
import { TokenTypeHint } from '../enums/TokenTypeHint';
import { Jwt } from './Jwt';

export class Token implements IToken {
  private readonly logger: ILogger;
  private readonly config: IClientConfig;
  private readonly issuer: IIssuer;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private idToken: string | null = null;
  private expiresAt: number | null = null;

  constructor(logger: ILogger, config: IClientConfig, issuer: IIssuer) {
    this.logger = logger;
    this.config = config;
    this.issuer = issuer;
  }

  public setTokens(tokenResponse: TokenSet): void {
    this.accessToken = tokenResponse.access_token;
    this.refreshToken = tokenResponse.refresh_token || null;
    this.expiresAt = tokenResponse.expires_in
      ? Date.now() + tokenResponse.expires_in * 1000
      : null;
    if (tokenResponse.id_token) {
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

    const issuer = await this.issuer.discover();
    const tokenEndpoint = issuer.token_endpoint;

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

  public getTokens(): TokenSet | null {
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
    const issuer = await this.issuer.discover();
    if (!issuer.introspection_endpoint) {
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
        issuer.introspection_endpoint,
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
    const issuer = await this.issuer.discover();
    if (!issuer.revocation_endpoint) {
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
      await this.performTokenRequest(issuer.revocation_endpoint, params);
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
      const response = await fetch(endpoint, { method: 'POST', body, headers });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(
          `Token request failed: ${response.status} ${JSON.stringify(json)}`,
        );
      }
      return json;
    } catch (error) {
      this.logger.error('Token request failed', { endpoint, params, error });
      throw new ClientError('Token request failed', 'TOKEN_REQUEST_ERROR', {
        originalError: error,
      });
    }
  }

  /**
   * Exchanges an authorization code for tokens.
   * @param code The authorization code received from the authorization server.
   * @param codeVerifier Optional code verifier if PKCE is used.
   * @throws {ClientError} If the exchange fails.
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier?: string | null,
  ): Promise<void> {
    const client = await this.issuer.discover();
    const tokenEndpoint = client.token_endpoint;

    const params = this.buildTokenRequestParams(code, codeVerifier);
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const body = buildUrlEncodedBody(params);

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        body,
        headers,
      });
      const tokenResponse: TokenSet = await response.json();

      if (!response.ok) {
        throw new Error(
          `Token exchange failed: ${response.status} ${JSON.stringify(tokenResponse)}`,
        );
      }

      this.setTokens(tokenResponse);
      this.logger.info('Exchanged grant for tokens', {
        grantType: this.config.grantType,
      });
    } catch (error) {
      this.logger.error('Failed to exchange grant for tokens', {
        error,
        grantType: this.config.grantType,
      });
      throw new ClientError('Token exchange failed', 'TOKEN_EXCHANGE_ERROR', {
        originalError: error,
      });
    }
  }

  /**
   * Builds the parameters for the token request based on the grant type.
   * @param code The code being exchanged.
   * @param codeVerifier Optional code verifier.
   * @returns The parameters as a record of strings.
   */
  private buildTokenRequestParams(
    code: string,
    codeVerifier?: string,
  ): Record<string, string> {
    const baseParams: Record<string, string> = {
      grant_type: this.config.grantType,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
    };

    if (this.config.clientSecret) {
      baseParams.client_secret = this.config.clientSecret;
    }

    switch (this.config.grantType) {
      case GrantType.AuthorizationCode:
        baseParams.code = code;
        if (codeVerifier) baseParams.code_verifier = codeVerifier;
        break;
      case GrantType.RefreshToken:
        baseParams.refresh_token = code;
        break;
      case GrantType.DeviceCode:
        baseParams.device_code = code;
        break;
      case GrantType.JWTBearer:
      case GrantType.SAML2Bearer:
        baseParams.assertion = code;
        baseParams.scope = this.config.scopes.join(' ');
        break;
      case GrantType.ClientCredentials:
      case GrantType.Custom:
        // Handle as needed
        break;
      default:
        throw new ClientError(
          `Unsupported grant type: ${this.config.grantType}`,
          'UNSUPPORTED_GRANT_TYPE',
        );
    }

    return baseParams;
  }

  /**
   * Extracts claims from the access token.
   * If the access token is a JWT, decode and return its payload.
   * If opaque, optionally use the UserInfo endpoint to fetch claims.
   *
   * @returns A promise that resolves to an array of claim keys.
   */
  public async getClaims(): Promise<Record<string, any>> {
    try {
      await this.ensureToken();
    } catch (error) {
      this.logger.error('No access token available', {
        error: new ClientError('No access token available', 'NO_ACCESS_TOKEN'),
      });
      throw new ClientError('No access token available', 'NO_ACCESS_TOKEN');
    }

    if (this.isJwt(this.accessToken)) {
      try {
        const jwtPayload = await Jwt.verify(this.accessToken, {
          logger: this.logger,
          client: await this.issuer.discover(),
          clientId: this.config.clientId,
        });
        this.logger.debug('Claims extracted from JWT access token', {
          payload: jwtPayload,
        });
        return jwtPayload;
      } catch (error) {
        this.logger.error('Failed to verify JWT access token', { error });
        throw new ClientError('Failed to verify access token', 'DECODE_ERROR', {
          originalError: error,
        });
      }
    } else {
      // Access token is opaque; use UserInfo endpoint if available
      this.logger.debug(
        'Access token is opaque; fetching claims from UserInfo endpoint',
      );
      try {
        const userInfo = await this.fetchUserInfo();
        this.logger.debug('Claims fetched from UserInfo endpoint', {
          userInfo,
        });
        return userInfo;
      } catch (error) {
        this.logger.error('Failed to fetch user info', { error });
        throw new ClientError('Failed to fetch user info', 'USERINFO_ERROR', {
          originalError: error,
        });
      }
    }
  }

  /**
   * Ensures that the client is initialized and has a valid access token.
   */
  private async ensureToken(): Promise<void> {
    if (this.accessToken && this.isTokenValid()) {
      return;
    }
    if (this.refreshToken) {
      await this.refreshAccessToken();
      return;
    }
    throw new ClientError('No valid access token available', 'NO_VALID_TOKEN');
  }

  /**
   * Determines if a token is a JWT based on its structure.
   *
   * @param token The access token to check.
   * @returns True if the token is a JWT, false otherwise.
   */
  private isJwt(token: string): boolean {
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Fetches user information from the UserInfo endpoint using the access token.
   *
   * @returns A promise that resolves to the user info object.
   */
  private async fetchUserInfo(): Promise<Record<string, any>> {
    const userInfoEndpoint = (await this.issuer.discover()).userinfo_endpoint;
    if (!userInfoEndpoint) {
      throw new ClientError(
        'UserInfo endpoint not available',
        'USERINFO_UNAVAILABLE',
      );
    }

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(userInfoEndpoint, {
        method: 'GET',
        headers,
      });

      const userInfo = await response.json();
      return userInfo;
    } catch (error) {
      this.logger.error('Error fetching UserInfo', { error });
      throw error;
    }
  }
}
