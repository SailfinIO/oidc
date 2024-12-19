// src/clients/AuthClient.ts

import { IClientConfig } from '../interfaces/IClientConfig';
import { DiscoveryClient } from './DiscoveryClient';
import { TokenManager } from '../token/TokenManager';
import { Logger } from '../utils/Logger';
import { ClientError } from '../errors/ClientError';
import { Helpers } from '../utils/Helpers';
import { HTTPClient } from '../utils/HTTPClient';
import { ITokenResponse } from '../interfaces';

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
    this.tokenManager = new TokenManager(this.logger);
  }

  public async getAuthorizationUrl(
    state: string,
    codeChallenge?: string,
  ): Promise<string> {
    const discoveryConfig = await this.discoveryClient.fetchDiscoveryConfig();
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

    const params = {
      grant_type: this.config.grantType || 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret || '',
      code_verifier: codeVerifier || '',
    };

    const body = Helpers.buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(tokenEndpoint, body);
      const tokenResponse: ITokenResponse = JSON.parse(response);
      this.tokenManager.setTokens(tokenResponse);
      this.logger.info('Exchanged authorization code for tokens');
    } catch (error) {
      this.logger.error(
        'Failed to exchange authorization code for tokens',
        error,
      );
      throw new ClientError('Token exchange failed', 'TOKEN_EXCHANGE_ERROR', {
        originalError: error,
      });
    }
  }

  public getTokenManager(): TokenManager {
    return this.tokenManager;
  }
}
