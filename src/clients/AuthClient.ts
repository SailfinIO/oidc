// src/clients/AuthClient.ts

import { IClientConfig } from '../interfaces/IClientConfig';
import { DiscoveryClient } from './DiscoveryClient';
import { TokenManager } from '../token/TokenManager';
import { Logger } from '../utils/Logger';
import { ClientError } from '../errors/ClientError';
import { Helpers } from '../utils/Helpers';
import { HTTPClient } from '../utils/HTTPClient';
import { ITokenResponse } from '../interfaces';
import { GrantType } from '../enums/GrantType';

export class AuthClient {
  private config: IClientConfig;
  private discoveryClient: DiscoveryClient;
  private tokenManager: TokenManager;
  private logger: Logger;
  private httpClient: HTTPClient;

  constructor(config: IClientConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.httpClient = new HTTPClient(this.logger);
    this.discoveryClient = new DiscoveryClient(
      config.discoveryUrl,
      this.logger,
    );
    this.tokenManager = new TokenManager(this.logger, this.config);
  }

  public async getAuthorizationUrl(
    state: string,
    codeChallenge?: string,
  ): Promise<string> {
    const discoveryConfig = await this.discoveryClient.fetchDiscoveryConfig();

    // Ensure the grant type supports authorization URLs
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

    const url = Helpers.buildAuthorizationUrl({
      authorizationEndpoint: discoveryConfig.authorization_endpoint,
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      responseType: this.config.responseType || 'code',
      scope: this.config.scopes.join(' '),
      state,
      codeChallenge,
      codeChallengeMethod: 'S256',
    });
    this.logger.debug('Authorization URL generated', { url });
    return url;
  }

  public async exchangeCodeForToken(
    code: string,
    codeVerifier?: string,
  ): Promise<void> {
    const discoveryConfig = await this.discoveryClient.fetchDiscoveryConfig();
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
        // Assuming 'code' here represents the password or token
        params = {
          ...params,
          username: code, // You might want to adjust based on actual usage
          password: codeVerifier || '',
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

    const body = Helpers.buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(tokenEndpoint, body);
      const tokenResponse: ITokenResponse = JSON.parse(response);
      this.tokenManager.setTokens(tokenResponse);
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

  public getTokenManager(): TokenManager {
    return this.tokenManager;
  }
}
