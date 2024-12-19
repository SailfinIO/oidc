// src/clients/OIDCClient.ts

import { IClientConfig } from '../interfaces/IClientConfig';
import { AuthClient } from './AuthClient';
import { TokenManager } from '../token/TokenManager';
import { UserInfoClient } from './UserInfoClient';
import { Logger } from '../utils/Logger';
import { LogLevel } from '../enums';
import { DiscoveryClient } from './DiscoveryClient';
import { IDiscoveryConfig, ILogger, IUserInfo } from '../interfaces';
import { ClientError } from '../errors';

export class OIDCClient {
  private readonly config: IClientConfig;
  private readonly authClient: AuthClient;
  private readonly tokenManager: TokenManager;
  private readonly logger: ILogger;
  private userInfoClient: UserInfoClient;
  private discoveryConfig: IDiscoveryConfig;
  private initialized: boolean = false;

  constructor(config: IClientConfig) {
    this.config = config;
    this.validateConfig(config);
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

  private validateConfig(config: IClientConfig): void {
    this.logger.debug('Validating OIDC Client configuration');
    if (!config.clientId)
      throw new ClientError('clientId is required', 'CONFIG_ERROR');
    if (!config.redirectUri)
      throw new ClientError('redirectUri is required', 'CONFIG_ERROR');
    if (!config.scopes || !config.scopes.length)
      throw new ClientError('At least one scope is required', 'CONFIG_ERROR');
    if (!config.discoveryUrl)
      throw new ClientError('discoveryUrl is required', 'CONFIG_ERROR');
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
    this.initialized = true;
    this.logger.info('OIDC Client initialized successfully');
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new ClientError(
        'OIDCClient not initialized. Call initialize() first.',
        'NOT_INITIALIZED',
      );
    }
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

  public async getUserInfo(): Promise<IUserInfo> {
    this.ensureInitialized();
    return this.userInfoClient.getUserInfo();
  }

  public getTokenManager(): TokenManager {
    return this.tokenManager;
  }

  public getAuthClient(): AuthClient {
    return this.authClient;
  }

  // Add more methods as needed, such as logout, token refresh, etc.
}
