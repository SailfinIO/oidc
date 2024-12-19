// src/clients/OIDCClient.ts

import { IClientConfig } from '../interfaces/IClientConfig';
import { AuthClient } from './AuthClient';
import { TokenManager } from '../token/TokenManager';
import { UserInfoClient } from './UserInfoClient';
import { Logger } from '../utils/Logger';
import { LogLevel } from '../enums';
import { DiscoveryClient } from './DiscoveryClient';
import { IDiscoveryConfig } from 'src/interfaces';

export class OIDCClient {
  private config: IClientConfig;
  private authClient: AuthClient;
  private tokenManager: TokenManager;
  private userInfoClient: UserInfoClient;
  private logger: Logger;
  private discoveryConfig: IDiscoveryConfig;

  constructor(config: IClientConfig) {
    this.config = config;
    this.logger = new Logger(OIDCClient.name, LogLevel.INFO, true);
    this.authClient = new AuthClient(config);
    this.tokenManager = this.authClient.getTokenManager();
  }

  public async initialize(): Promise<void> {
    this.logger.debug('Initializing OIDC Client');
    const discoveryClient = new DiscoveryClient(
      this.config.discoveryUrl,
      this.logger,
    );
    this.discoveryConfig = await discoveryClient.fetchDiscoveryConfig();
    this.userInfoClient = new UserInfoClient(
      this.tokenManager,
      this.discoveryConfig,
      this.logger,
    );
    this.logger.info('OIDC Client initialized successfully');
  }

  public async getAuthorizationUrl(
    state: string,
    codeVerifier?: string,
  ): Promise<string> {
    return this.authClient.getAuthorizationUrl(state, codeVerifier);
  }

  public async handleRedirect(
    code: string,
    codeVerifier?: string,
  ): Promise<void> {
    await this.authClient.exchangeCodeForToken(code, codeVerifier);
  }

  public async getUserInfo(): Promise<any> {
    return this.userInfoClient.getUserInfo();
  }

  // Add more methods as needed, such as logout, token refresh, etc.
}
