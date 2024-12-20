// src/clients/OIDCClient.ts

import { IClientConfig } from '../interfaces/IClientConfig';
import { AuthClient } from './AuthClient';
import { TokenClient } from './TokenClient';
import { UserInfoClient } from './UserInfoClient';
import { Logger, JwtValidator } from '../utils';
import { BinaryToTextEncoding, GrantType, LogLevel } from '../enums';
import { DiscoveryClient } from './DiscoveryClient';
import { IDiscoveryConfig, ILogger, IUserInfo } from '../interfaces';
import { ClientError } from '../errors';
import { randomBytes } from 'crypto';

export class OIDCClient {
  private readonly config: IClientConfig;
  private readonly authClient: AuthClient;
  private readonly tokenClient: TokenClient;
  private readonly logger: ILogger;
  private userInfoClient: UserInfoClient;
  private discoveryConfig: IDiscoveryConfig;

  private initialized: boolean = false;

  private stateMap: Map<string, string> = new Map(); // state -> nonce

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
    this.validateConfig(config);
    this.authClient = new AuthClient(config, this.logger as Logger);
    this.tokenClient = this.authClient.getTokenManager();
  }

  private validateConfig(config: IClientConfig): void {
    if (!config.clientId)
      throw new ClientError('clientId is required', 'CONFIG_ERROR');
    if (!config.redirectUri)
      throw new ClientError('redirectUri is required', 'CONFIG_ERROR');
    if (!config.scopes || !config.scopes.length)
      throw new ClientError('At least one scope is required', 'CONFIG_ERROR');
    if (!config.discoveryUrl)
      throw new ClientError('discoveryUrl is required', 'CONFIG_ERROR');

    // Default grantType if not provided
    if (!config.grantType) {
      this.logger.debug(
        'No grantType specified, defaulting to authorization_code',
      );
      config.grantType = GrantType.AuthorizationCode;
    }
  }

  public async initialize(): Promise<void> {
    this.logger.debug('Initializing OIDC Client');
    const discoveryClient = new DiscoveryClient(
      this.config.discoveryUrl,
      this.logger as Logger,
    );
    this.discoveryConfig = await discoveryClient.fetchDiscoveryConfig();
    this.userInfoClient = new UserInfoClient(
      this.tokenClient,
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
    if (this.stateMap.size > 0) {
      throw new ClientError(
        'An authorization flow is already in progress',
        'FLOW_IN_PROGRESS',
      );
    }

    const state = this.generateRandomString();
    const nonce = this.generateRandomString();

    // Store state -> nonce mapping
    this.stateMap.set(state, nonce);

    const { url } = await this.authClient.getAuthorizationUrl(state, nonce);
    return { url };
  }

  public async handleRedirect(
    code: string,
    returnedState: string,
  ): Promise<void> {
    const expectedNonce = this.stateMap.get(returnedState);
    if (!expectedNonce) {
      throw new ClientError(
        'State does not match or not found',
        'STATE_MISMATCH',
      );
    }

    await this.authClient.exchangeCodeForToken(
      code,
      this.authClient.getCodeVerifier(),
    );

    // After token is obtained and validated, remove the state entry
    this.stateMap.delete(returnedState);
    // After token is obtained:
    const tokens = this.tokenClient.getTokens();
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

    this.tokenClient.setTokens(tokenResponse);
    this.logger.info('Tokens set from implicit flow fragment');
  }

  public async getUserInfo(): Promise<IUserInfo> {
    this.ensureInitialized();
    return this.userInfoClient.getUserInfo();
  }

  public async introspectToken(token: string) {
    this.ensureInitialized();
    return this.tokenClient.introspectToken(token);
  }

  public async revokeToken(
    token: string,
    tokenTypeHint?: 'refresh_token' | 'access_token',
  ) {
    this.ensureInitialized();
    return this.tokenClient.revokeToken(token, tokenTypeHint);
  }

  public getAuthClient(): AuthClient {
    return this.authClient;
  }

  private generateRandomString(length = 32): string {
    return randomBytes(length).toString(BinaryToTextEncoding.HEX);
  }
}
