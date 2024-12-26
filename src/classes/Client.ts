// src/classes/Client.ts

import { Auth } from './Auth';
import { UserInfo } from './UserInfo';
import { Logger, parse } from '../utils';
import { GrantType, LogLevel, TokenTypeHint, Storage } from '../enums';
import { Issuer } from './Issuer';
import {
  IClientConfig,
  ILogger,
  ITokenIntrospectionResponse,
  ITokenResponse,
  IUserInfo,
  IUser,
  IIssuer,
  IToken,
  IAuth,
  ISession,
  ISessionData,
  IStoreContext,
  ISessionStore,
} from '../interfaces';
import { ClientError } from '../errors';
import { Token } from './Token';
import { Session } from './Session';
import { Store, StoreInstances } from './Store';
import { defaultClientConfig } from '../config/defaultClientConfig';

export class Client {
  private readonly config: IClientConfig;
  private readonly auth: IAuth;
  private readonly tokenClient: IToken;
  private readonly logger: ILogger;
  private readonly issuer: IIssuer;
  private readonly sessionStore: ISessionStore | null;
  private userInfoClient!: IUserInfo;
  private initialized: boolean = false;
  private session: ISession | null = null;

  constructor(userConfig: Partial<IClientConfig>) {
    // Merge userConfig with defaultClientConfig
    this.config = { ...defaultClientConfig, ...userConfig } as IClientConfig;

    // Validate that required fields are provided
    this.validateRequiredConfig(this.config);

    const envLogLevel = process.env.OIDC_CLIENT_LOG_LEVEL as LogLevel;

    this.logger =
      this.config.logging?.logger ||
      new Logger(
        Client.name,
        this.config.logging?.logLevel || envLogLevel || LogLevel.INFO,
        true,
      );

    // Initialize the store using Store
    const storeInstances: StoreInstances = Store.create(
      this.config.storage?.mechanism || Storage.MEMORY,
      this.config.storage?.options,
      this.logger,
    );

    this.sessionStore = storeInstances.sessionStore;

    this.issuer = new Issuer(this.config.discoveryUrl, this.logger);
    this.tokenClient = new Token(this.logger, this.config, this.issuer);
    this.auth = new Auth(
      this.config,
      this.logger,
      this.issuer,
      this.tokenClient,
    );

    // Initialize session as null; it will be set after discovering issuer
    this.session = null;

    this.validateConfig(this.config);
  }

  private async initializeInternal(): Promise<void> {
    try {
      this.logger.debug('Initializing OIDC Client');
      const clientMetadata = await this.issuer.discover();
      this.userInfoClient = new UserInfo(
        this.tokenClient,
        clientMetadata,
        this.logger,
      );
      this.session = new Session(
        this.config,
        this.logger,
        this.tokenClient,
        this.userInfoClient,
        this.sessionStore,
      );
      this.initialized = true;
      this.logger.info('OIDC Client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OIDC Client', { error });
      throw new ClientError('Initialization failed', 'INITIALIZATION_ERROR', {
        originalError: error,
      });
    }
  }

  private validateRequiredConfig(config: IClientConfig): void {
    const requiredFields: Array<keyof IClientConfig> = [
      'clientId',
      'redirectUri',
      'scopes',
      'discoveryUrl',
    ];
    requiredFields.forEach((field) => {
      if (!config[field]) {
        throw new ClientError(`${field} is required`, 'CONFIG_ERROR');
      }
    });
  }

  private validateConfig(config: IClientConfig): void {
    if (!config.clientId)
      throw new ClientError('clientId is required', 'CONFIG_ERROR');
    if (!config.redirectUri)
      throw new ClientError('redirectUri is required', 'CONFIG_ERROR');
    if (!config.scopes?.length) {
      throw new ClientError('At least one scope is required', 'CONFIG_ERROR');
    }
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

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initializeInternal();
    }
  }

  public setLogLevel(level: LogLevel): void {
    this.logger.setLogLevel(level);
  }

  /**
   * Generates the authorization URL to initiate the OAuth2/OIDC flow.
   * Returns both the URL and the state for CSRF protection.
   * @returns The authorization URL and the generated state.
   */
  public async getAuthorizationUrl(): Promise<{ url: string; state: string }> {
    await this.ensureInitialized();
    return this.auth.getAuthorizationUrl();
  }

  /**
   * Handles the redirect callback for authorization code flow.
   * Exchanges the authorization code for tokens and validates the state and nonce.
   * Updates the session with tokens and user info.
   * @param code The authorization code received from the provider.
   * @param returnedState The state returned in the redirect to validate against CSRF.
   * @param context The store context containing the request and response.
   */
  public async handleRedirect(
    code: string,
    returnedState: string,
    context: IStoreContext, // Pass context here
  ): Promise<void> {
    await this.ensureInitialized();
    await this.auth.handleRedirect(code, returnedState);

    // After handling redirect, tokens should be set in tokenClient
    const tokens = this.tokenClient.getTokens();
    if (!tokens) {
      throw new ClientError(
        'No tokens available after handling redirect.',
        'NO_TOKENS',
      );
    }

    // Fetch user info
    let userInfo: IUser | null = null;
    try {
      userInfo = await this.userInfoClient.getUserInfo();
    } catch (error) {
      this.logger.warn('Failed to fetch user info after handling redirect', {
        error,
      });
      // Decide whether to proceed without user info or throw an error
      // Here, we'll proceed without user info
    }

    const sessionData: ISessionData = {
      cookie: tokens,
      user: userInfo || undefined,
    };

    if (this.sessionStore) {
      // Store session data and receive `sid`
      const sid = await this.sessionStore.set(sessionData, context);
      this.logger.debug('Session data stored after redirect handling', { sid });
    } else {
      // Fallback to using IStore directly (if applicable)
      // This block can be customized based on your design
      throw new ClientError(
        'Session store is not configured.',
        'SESSION_STORE_ERROR',
      );
    }

    // Optionally start token refresh if enabled
    if (this.config.session?.useSilentRenew && this.session) {
      this.session.start(context);
    }
  }

  /**
   * Handles the redirect callback for implicit flow.
   * Extracts tokens from the URL fragment and updates the session.
   * @param fragment The URL fragment containing tokens.
   * @param context The store context containing the request and response.
   */
  public async handleRedirectForImplicitFlow(
    fragment: string,
    context: IStoreContext, // Pass context here
  ): Promise<void> {
    await this.ensureInitialized();
    await this.auth.handleRedirectForImplicitFlow(fragment);

    // After handling redirect, tokens should be set in tokenClient
    const tokens = this.tokenClient.getTokens();
    if (!tokens) {
      throw new ClientError(
        'No tokens available after handling redirect.',
        'NO_TOKENS',
      );
    }

    // Fetch user info
    let userInfo: IUser | null = null;
    try {
      userInfo = await this.userInfoClient.getUserInfo();
    } catch (error) {
      this.logger.warn(
        'Failed to fetch user info after handling implicit flow redirect',
        { error },
      );
      // Proceed without user info
    }

    const sessionData: ISessionData = {
      cookie: tokens,
      user: userInfo || undefined,
    };

    if (this.sessionStore) {
      // Store session data and receive `sid`
      const sid = await this.sessionStore.set(sessionData, context);
      this.logger.debug(
        'Session data stored after implicit flow redirect handling',
        { sid },
      );
    } else {
      // Fallback to using IStore directly (if applicable)
      throw new ClientError(
        'Session store is not configured.',
        'SESSION_STORE_ERROR',
      );
    }

    // Optionally start token refresh if enabled
    if (this.config.session?.useSilentRenew && this.session) {
      this.session.start(context);
    }
  }

  /**
   * Retrieves user information from the UserInfo endpoint.
   * @returns User information.
   */
  public async getUserInfo(): Promise<IUser> {
    await this.ensureInitialized();
    return this.userInfoClient.getUserInfo();
  }

  /**
   * Introspects a token to verify its validity and retrieve its metadata.
   * @param token The token to introspect.
   * @returns The introspection response.
   */
  public async introspectToken(
    token: string,
  ): Promise<ITokenIntrospectionResponse> {
    await this.ensureInitialized();
    return this.tokenClient.introspectToken(token);
  }

  /**
   * Revokes a token (access or refresh token).
   * @param token The token to revoke.
   * @param tokenTypeHint Optional hint about the type of token: 'refresh_token' or 'access_token'.
   */
  public async revokeToken(
    token: string,
    tokenTypeHint?: TokenTypeHint,
  ): Promise<void> {
    await this.ensureInitialized();
    return this.tokenClient.revokeToken(token, tokenTypeHint);
  }

  /**
   * Initiates the device authorization flow.
   * @returns Device authorization details.
   */
  public async startDeviceAuthorization(): Promise<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }> {
    await this.ensureInitialized();
    return this.auth.startDeviceAuthorization();
  }

  /**
   * Polls the token endpoint to obtain tokens for the device authorization flow.
   * @param device_code The device code obtained from device authorization.
   * @param interval Polling interval in seconds.
   * @param timeout Maximum time to wait in milliseconds.
   * @param context The store context containing the request and response.
   */
  public async pollDeviceToken(
    device_code: string,
    interval: number = 5,
    timeout?: number,
    context?: IStoreContext, // Pass context here
  ): Promise<void> {
    await this.ensureInitialized();
    await this.auth.pollDeviceToken(device_code, interval, timeout);

    // After polling, tokens should be set in tokenClient
    const tokens = this.tokenClient.getTokens();
    if (!tokens) {
      throw new ClientError(
        'No tokens available after device token polling.',
        'NO_TOKENS',
      );
    }

    // Fetch user info
    let userInfo: IUser | null = null;
    try {
      userInfo = await this.userInfoClient.getUserInfo();
    } catch (error) {
      this.logger.warn('Failed to fetch user info after device token polling', {
        error,
      });
      // Proceed without user info
    }

    const sessionData: ISessionData = {
      cookie: tokens,
      user: userInfo || undefined,
    };

    if (context && this.sessionStore) {
      // Store session data and receive `sid`
      const sid = await this.sessionStore.set(sessionData, context);
      this.logger.debug('Session data stored after device token polling', {
        sid,
      });

      // Optionally start token refresh if enabled
      if (this.config.session?.useSilentRenew && this.session) {
        this.session.start(context);
      }
    }
  }

  /**
   * Retrieves the current access token, refreshing it if necessary.
   * @returns The access token or null if not available.
   */
  public async getAccessToken(): Promise<string | null> {
    await this.ensureInitialized();
    return this.tokenClient.getAccessToken();
  }

  /**
   * Retrieves all stored tokens.
   * @returns The token response or null if no tokens are stored.
   */
  public async getTokens(): Promise<ITokenResponse | null> {
    await this.ensureInitialized();
    return this.tokenClient.getTokens();
  }

  /**
   * Clears all stored tokens and stops the session.
   * @param context The store context containing the request and response.
   */
  public async clearTokens(context: IStoreContext): Promise<void> {
    await this.ensureInitialized();
    this.tokenClient.clearTokens();
    if (this.session) {
      await this.session.stop(context);
      // Retrieve `sid` from cookies to destroy the session
      if (context.request && context.response) {
        const cookieHeader = context.request.headers['cookie'];
        let sid: string | null = null;
        if (cookieHeader && typeof cookieHeader === 'string') {
          const cookies = parse(cookieHeader);
          sid = cookies[this.config.session?.cookie?.name || 'sid'];
        }
        if (sid && this.sessionStore) {
          await this.sessionStore.destroy(sid, context);
          this.logger.debug('Session cleared and destroyed', { sid });
        }
      }
    }
  }

  /**
   * Initiates the logout flow.
   * @param idTokenHint Optional ID token to hint the logout request.
   * @returns The logout URL to which the user should be redirected.
   */
  public async logout(idTokenHint?: string): Promise<string> {
    await this.ensureInitialized();
    const logoutUrl = await this.auth.getLogoutUrl(idTokenHint);
    this.logger.info('Logout initiated', { logoutUrl });
    return logoutUrl;
  }
}
