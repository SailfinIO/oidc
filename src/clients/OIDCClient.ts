// src/clients/OIDCClient.ts

import { IClientConfig } from '../interfaces/IClientConfig';
import { AuthClient } from './AuthClient';
import { TokenManager } from '../token/TokenManager';
import { UserInfoClient } from './UserInfoClient';
import { Logger } from '../utils/Logger';
import { BinaryToTextEncoding, GrantType, LogLevel } from '../enums';
import { DiscoveryClient } from './DiscoveryClient';
import { IDiscoveryConfig, ILogger, IUserInfo } from '../interfaces';
import { ClientError } from '../errors';
import { randomBytes } from 'crypto';
import { JwtValidator } from 'src/token/JwtValidator';

export class OIDCClient {
  private readonly config: IClientConfig;
  private readonly authClient: AuthClient;
  private readonly tokenManager: TokenManager;
  private readonly logger: ILogger;
  private userInfoClient: UserInfoClient;
  private discoveryConfig: IDiscoveryConfig;

  private initialized: boolean = false;

  private stateMap: Map<string, string> = new Map(); // state -> nonce
  private activeState: string | null = null;
  private activeNonce: string | null = null;

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

  public async getAuthorizationUrl(): Promise<{ url: string }> {
    const state = this.generateRandomString();
    const nonce = this.generateRandomString();

    // Store them so we can validate later.
    // We can store them together, keyed by state, or individually.
    this.stateMap.set(state, nonce);
    this.activeState = state;
    this.activeNonce = nonce;

    const { url } = await this.authClient.getAuthorizationUrl(state, nonce);
    return { url };
  }

  public async handleRedirect(
    code: string,
    returnedState: string,
  ): Promise<void> {
    if (!this.activeState || !this.stateMap.has(returnedState)) {
      throw new ClientError('State does not match', 'STATE_MISMATCH');
    }

    const expectedNonce = this.stateMap.get(returnedState);
    // Now exchange code for token
    await this.authClient.exchangeCodeForToken(
      code,
      this.authClient.getCodeVerifier(),
    );

    // After token is obtained:
    const tokens = this.tokenManager.getTokens();
    if (tokens.id_token) {
      const jwtValidator = new JwtValidator(
        this.logger as Logger,
        this.discoveryConfig,
        this.config.clientId,
      );
      await jwtValidator.validateIdToken(tokens.id_token, expectedNonce);
      this.logger.info('ID token validated successfully');
    } else {
      this.logger.warn('No ID token returned to validate');
    }

    // Cleanup
    this.stateMap.delete(returnedState);
    this.activeState = null;
    this.activeNonce = null;
  }

  public handleRedirectForImplicitFlow(fragment: string): void {
    if (this.config.grantType !== GrantType.Implicit) {
      throw new ClientError(
        `handleRedirectForImplicitFlow() is only applicable for implicit flows. Current grantType: ${this.config.grantType}`,
        'INVALID_GRANT_TYPE',
      );
    }

    // The fragment might look like: #access_token=xyz&id_token=abc&expires_in=3600&...
    const params = new URLSearchParams(fragment.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const idToken = params.get('id_token');
    const expiresIn = params.get('expires_in');
    const tokenType = params.get('token_type') || 'Bearer';

    if (!accessToken) {
      throw new ClientError(
        'No access_token found in redirect fragment for implicit flow',
        'TOKEN_MISSING',
      );
    }

    const tokenResponse = {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn ? parseInt(expiresIn, 10) : undefined,
      id_token: idToken || undefined,
    };

    this.tokenManager.setTokens(tokenResponse);
    this.logger.info('Tokens set from implicit flow fragment');
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

  private generateRandomString(length = 32): string {
    return randomBytes(length).toString(BinaryToTextEncoding.HEX);
  }
}
