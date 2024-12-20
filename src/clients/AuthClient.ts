// src/clients/AuthClient.ts

import { TokenClient } from './TokenClient';
import { ClientError } from '../errors/ClientError';
import {
  buildAuthorizationUrl,
  buildLogoutUrl,
  buildUrlEncodedBody,
} from '../utils';
import {
  ILogoutUrlParams,
  ITokenResponse,
  IHttpClient,
  IDiscoveryClient,
  ILogger,
  ITokenClient,
  IClientConfig,
} from '../interfaces';
import { GrantType } from '../enums/GrantType';
import { createHash, randomBytes } from 'crypto';
import { Algorithm } from '../enums/Algorithm';
import { BinaryToTextEncoding } from '../enums/BinaryToTextEncoding';

export class AuthClient {
  private readonly config: IClientConfig;
  private readonly discoveryClient: IDiscoveryClient;
  private readonly tokenClient: ITokenClient;
  private readonly logger: ILogger;
  private readonly httpClient: IHttpClient;

  private codeVerifier: string | null = null;

  constructor(
    config: IClientConfig,
    logger: ILogger,
    discoveryClient: IDiscoveryClient,
    httpClient: IHttpClient,
  ) {
    this.config = config;
    this.logger = logger;
    this.httpClient = httpClient;
    this.discoveryClient = discoveryClient;
    this.tokenClient = new TokenClient(
      this.logger,
      this.config,
      this.discoveryClient,
      this.httpClient,
    );
  }

  public async getAuthorizationUrl(
    state: string,
    nonce?: string,
  ): Promise<{ url: string; codeVerifier?: string }> {
    const discoveryConfig = await this.discoveryClient.getDiscoveryConfig();

    if (
      this.config.grantType !== GrantType.AuthorizationCode &&
      this.config.grantType !== GrantType.Implicit &&
      this.config.grantType !== GrantType.DeviceCode
    ) {
      throw new ClientError(
        `Grant type ${this.config.grantType} does not support authorization URLs.`,
        'INVALID_GRANT_TYPE',
      );
    }

    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    // Only generate PKCE if grantType is authorization_code and PKCE is enabled
    if (
      this.config.pkce &&
      this.config.grantType === GrantType.AuthorizationCode
    ) {
      codeVerifier = this.generateCodeVerifier();
      this.codeVerifier = codeVerifier;
      codeChallenge = this.generateCodeChallenge(codeVerifier);
    }

    const url = buildAuthorizationUrl(
      {
        authorizationEndpoint: discoveryConfig.authorization_endpoint,
        clientId: this.config.clientId,
        redirectUri: this.config.redirectUri,
        responseType: this.config.responseType || 'code',
        scope: this.config.scopes.join(' '),
        state,
        codeChallenge,
        codeChallengeMethod:
          codeChallenge && this.config.pkceMethod !== 'plain'
            ? this.config.pkceMethod || Algorithm.SHA256
            : undefined,
      },
      nonce ? { nonce } : undefined,
    );

    this.logger.debug('Authorization URL generated', { url });
    return { url, codeVerifier };
  }

  /**
   * Retrieve the previously generated code verifier.
   * @returns The code verifier if available.
   */
  public getCodeVerifier(): string | null {
    return this.codeVerifier;
  }

  public async exchangeCodeForToken(
    code: string,
    codeVerifier?: string,
    username?: string,
    password?: string,
  ): Promise<void> {
    const discoveryConfig = await this.discoveryClient.getDiscoveryConfig();
    const tokenEndpoint = discoveryConfig.token_endpoint;

    // Determine the grant type and set parameters accordingly
    let params: Record<string, string> = {
      grant_type: this.config.grantType,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      client_secret: this.config.clientSecret || '',
    };

    switch (this.config.grantType) {
      case GrantType.AuthorizationCode:
        params = {
          ...params,
          code,
          code_verifier: codeVerifier || '',
        };
        break;

      case GrantType.RefreshToken:
        params = {
          ...params,
          refresh_token: code, // Here, 'code' represents the refresh token
        };
        break;

      case GrantType.ClientCredentials:
        // Typically, no additional parameters are needed
        break;

      case GrantType.Password:
        if (!username || !password) {
          throw new ClientError(
            'Username and password are required for Password grant type',
            'INVALID_REQUEST',
          );
        }
        params = {
          ...params,
          username,
          password,
        };
        break;

      case GrantType.DeviceCode:
        params = {
          ...params,
          device_code: code,
        };
        break;

      case GrantType.JWTBearer:
        params = {
          ...params,
          assertion: code, // 'code' represents the JWT assertion
          scope: this.config.scopes.join(' '),
        };
        break;

      case GrantType.SAML2Bearer:
        params = {
          ...params,
          assertion: code, // 'code' represents the SAML assertion
        };
        break;

      case GrantType.Custom:
        // Handle custom grant types as needed
        break;

      default:
        throw new ClientError(
          `Unsupported grant type: ${this.config.grantType}`,
          'UNSUPPORTED_GRANT_TYPE',
        );
    }

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const body = buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(tokenEndpoint, body, headers);
      const tokenResponse: ITokenResponse = JSON.parse(response);
      this.tokenClient.setTokens(tokenResponse);
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

  public getTokenManager(): ITokenClient {
    return this.tokenClient;
  }

  private generateCodeVerifier(): string {
    return randomBytes(32).toString(BinaryToTextEncoding.BASE_64_URL);
  }

  private generateCodeChallenge(verifier: string): string {
    // If pkceMethod is "plain", just return the verifier
    if (this.config.pkceMethod === 'plain') {
      return verifier;
    }

    // Otherwise, default to S256
    return createHash(Algorithm.SHA256.toLowerCase())
      .update(verifier)
      .digest(BinaryToTextEncoding.BASE_64_URL);
  }

  /**
   * Initiates the device authorization request to obtain a device_code and user_code.
   */
  public async startDeviceAuthorization(): Promise<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }> {
    if (this.config.grantType !== GrantType.DeviceCode) {
      throw new ClientError(
        `startDeviceAuthorization() is only applicable for DeviceCode flows. Current grantType: ${this.config.grantType}`,
        'INVALID_GRANT_TYPE',
      );
    }

    const discoveryConfig = await this.discoveryClient.getDiscoveryConfig();

    // Typically, the device authorization endpoint is derived from the discovery config
    // Some providers use `device_authorization_endpoint`
    const deviceEndpoint = (discoveryConfig as any)
      .device_authorization_endpoint;
    if (!deviceEndpoint) {
      throw new ClientError(
        'No device_authorization_endpoint found in discovery configuration.',
        'ENDPOINT_MISSING',
      );
    }

    const params = {
      client_id: this.config.clientId,
      scope: this.config.scopes.join(' '),
      // Add any additional parameters needed by your provider
    };

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const body = buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(
        deviceEndpoint,
        body,
        headers,
      );
      const json = JSON.parse(response);
      this.logger.info('Device authorization initiated');
      return {
        device_code: json.device_code,
        user_code: json.user_code,
        verification_uri: json.verification_uri,
        expires_in: json.expires_in,
        interval: json.interval || 5,
      };
    } catch (error) {
      this.logger.error('Failed to start device authorization', { error });
      throw new ClientError(
        'Device authorization failed',
        'DEVICE_AUTH_ERROR',
        {
          originalError: error,
        },
      );
    }
  }

  /**
   * Polls the token endpoint until the device is authorized or expires.
   */
  public async pollDeviceToken(
    device_code: string,
    interval: number = 5,
    timeout?: number,
  ): Promise<void> {
    if (this.config.grantType !== GrantType.DeviceCode) {
      throw new ClientError(
        `pollDeviceToken() is only applicable for DeviceCode flows. Current grantType: ${this.config.grantType}`,
        'INVALID_GRANT_TYPE',
      );
    }

    const discoveryConfig = await this.discoveryClient.getDiscoveryConfig();
    const tokenEndpoint = discoveryConfig.token_endpoint;
    const startTime = Date.now();

    while (true) {
      if (timeout && Date.now() - startTime > timeout) {
        throw new ClientError('Device code polling timed out', 'TIMEOUT_ERROR');
      }

      const params = {
        grant_type: GrantType.DeviceCode,
        device_code,
        client_id: this.config.clientId,
      };
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      const body = buildUrlEncodedBody(params);

      try {
        const response = await this.httpClient.post(
          tokenEndpoint,
          body,
          headers,
        );
        const tokenResponse = JSON.parse(response);
        this.tokenClient.setTokens(tokenResponse);
        this.logger.info('Device authorized and tokens obtained');
        return;
      } catch (error: any) {
        let errorBody: any = {};
        if (error.context?.body) {
          try {
            errorBody = JSON.parse(error.context.body);
          } catch (parseError) {
            this.logger.warn('Failed to parse error response as JSON', {
              originalError: parseError,
            });
            // If parsing fails, just continue with empty object or default handling

            // If the error response is not JSON, log the raw response
            this.logger.warn('Error response from token endpoint', {
              response: error.context.body,
            });
          }
        }

        if (errorBody.error === 'authorization_pending') {
          await this.sleep(interval * 1000);
          continue;
        } else if (errorBody.error === 'slow_down') {
          interval += 5;
          await this.sleep(interval * 1000);
          continue;
        } else if (errorBody.error === 'expired_token') {
          throw new ClientError('Device code expired', 'DEVICE_CODE_EXPIRED');
        } else {
          // Some other error
          throw new ClientError(
            'Device token polling failed',
            'TOKEN_POLLING_ERROR',
            {
              originalError: error,
            },
          );
        }
      }
    }
  }

  /**
   * Generates the logout URL to initiate the logout flow.
   * @param idTokenHint Optional ID token to hint the logout request.
   * @returns The logout URL.
   */
  public async getLogoutUrl(
    idTokenHint?: string,
    state?: string,
  ): Promise<string> {
    const discoveryConfig = await this.discoveryClient.getDiscoveryConfig();

    if (!discoveryConfig.end_session_endpoint) {
      throw new ClientError(
        'No end_session_endpoint found in discovery configuration.',
        'END_SESSION_ENDPOINT_MISSING',
      );
    }

    const logoutParams: ILogoutUrlParams = {
      endSessionEndpoint: discoveryConfig.end_session_endpoint,
      clientId: this.config.clientId,
      postLogoutRedirectUri: this.config.postLogoutRedirectUri,
      idTokenHint,
      state,
    };

    const logoutUrl = buildLogoutUrl(logoutParams);

    this.logger.debug('Logout URL generated', { logoutUrl });
    return logoutUrl;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
