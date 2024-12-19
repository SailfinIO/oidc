// src/clients/OIDCClient.ts

import { IClientConfig } from '../interfaces/IClientConfig';
import { AuthClient } from './AuthClient';
import { TokenManager } from '../token/TokenManager';
import { UserInfoClient } from './UserInfoClient';
import { Logger } from '../utils/Logger';
import { LogLevel } from '../enums';
import { DiscoveryClient } from './DiscoveryClient';
import { IDiscoveryConfig, ILogger } from 'src/interfaces';

export class OIDCClient {
  private config: IClientConfig;
  private authClient: AuthClient;
  private tokenManager: TokenManager;
  private userInfoClient: UserInfoClient;
  private logger: ILogger;
  private discoveryConfig: IDiscoveryConfig;

  constructor(config: IClientConfig) {
    this.config = config;
    const envLogLevel = process.env.OIDC_LOG_LEVEL as LogLevel;
    this.logger =
      config.logger ||
      new Logger(
        OIDCClient.name,
        config.logLevel || envLogLevel || LogLevel.INFO,
        true,
      );
    this.authClient = new AuthClient(config, this.logger as Logger);
    this.tokenManager = this.authClient.getTokenManager();
  }

  public async initialize(): Promise<void> {
    this.logger.debug('Initializing OIDC Client');
    const discoveryClient = new DiscoveryClient(
      this.config.discoveryUrl,
      this.logger as Logger,
    );
    this.discoveryConfig = await discoveryClient.fetchDiscoveryConfig();
    this.userInfoClient = new UserInfoClient(
      this.tokenManager,
      this.discoveryConfig,
      this.logger as Logger,
    );
    this.logger.info('OIDC Client initialized successfully');
  }

  public setLogLevel(level: LogLevel): void {
    this.logger.setLogLevel(level);
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
