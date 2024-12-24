// src/clients/Client.ts

import { Auth } from './Auth';
import { UserInfo } from './UserInfo';
import { Logger, generateRandomString } from '../utils';
import { GrantType, LogLevel, TokenTypeHint } from '../enums';
import { Issuer } from './Issuer';
import {
  IClientConfig,
  ILogger,
  ITokenIntrospectionResponse,
  ITokenResponse,
  IUserInfo,
  IUser,
  IIssuer,
  IJwtValidator,
  IToken,
  IHttp,
  IAuth,
} from '../interfaces';
import { ClientError } from '../errors';
import { Http } from './Http';
import { Token } from './Token';
import { JwtValidator } from './JwtValidator';

export class Client {
  private readonly config: IClientConfig;
  private readonly auth: IAuth;
  private readonly tokenClient: IToken;
  private readonly logger: ILogger;
  private readonly httpClient: IHttp;
  private readonly issuer: IIssuer;
  private readonly jwtValidator: IJwtValidator;
  private userInfoClient: IUserInfo;

  private initialized: boolean = false;

  private stateMap: Map<string, string> = new Map(); // state -> nonce

  constructor(config: IClientConfig) {
    this.config = config;
    const envLogLevel = process.env.OIDC_LOG_LEVEL as LogLevel; // Allow overriding log level via env var. This must be one of:  'debug', 'info', 'warn', 'error',
    this.logger =
      config.logging?.logger ||
      new Logger(
        Client.name,
        config.logging?.logLevel || envLogLevel || LogLevel.INFO,
        true,
      );
    this.httpClient = new Http(this.logger);
    this.issuer = new Issuer(this.config.discoveryUrl, this.logger);
    this.tokenClient = new Token(
      this.logger,
      this.config,
      this.issuer,
      this.httpClient,
    );
    this.auth = new Auth(
      config,
      this.logger,
      this.issuer,
      this.httpClient,
      this.tokenClient,
    );

    this.validateConfig(config);
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
    const client = await this.issuer.discoverClient();
    this.userInfoClient = new UserInfo(
      this.tokenClient,
      client,
      this.httpClient,
      this.logger,
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

  /**
   * Generates the authorization URL to initiate the OAuth2/OIDC flow.
   * @returns The authorization URL.
   */
  public async getAuthorizationUrl(): Promise<{ url: string }> {
    if (this.stateMap.size > 0) {
      throw new ClientError(
        'An authorization flow is already in progress',
        'FLOW_IN_PROGRESS',
      );
    }

    const state = generateRandomString();
    const nonce = generateRandomString();

    // Store state -> nonce mapping
    this.stateMap.set(state, nonce);

    const { url } = await this.auth.getAuthorizationUrl(state, nonce);
    return { url };
  }

  /**
   * Handles the redirect callback for authorization code flow.
   * Exchanges the authorization code for tokens.
   * @param code The authorization code received from the provider.
   * @param returnedState The state returned in the redirect to validate against CSRF.
   */
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

    await this.auth.exchangeCodeForToken(code, this.auth.getCodeVerifier());

    // After token is obtained and validated, remove the state entry
    this.stateMap.delete(returnedState);
    // After token is obtained:
    const tokens = this.tokenClient.getTokens();
    const client = await this.issuer.discoverClient();
    if (tokens.id_token) {
      const jwtValidator = new JwtValidator(
        this.logger as Logger,
        client,
        this.config.clientId,
      );
      await jwtValidator.validateIdToken(tokens.id_token, expectedNonce);
      this.logger.info('ID token validated successfully');
    } else {
      this.logger.warn('No ID token returned to validate');
    }
  }

  /**
   * Handles the redirect callback for implicit flow.
   * Extracts tokens from the URL fragment.
   * @param fragment The URL fragment containing tokens.
   */
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

  /**
   * Retrieves user information from the UserInfo endpoint.
   * @returns User information.
   */
  public async getUserInfo(): Promise<IUser> {
    this.ensureInitialized();
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
    this.ensureInitialized();
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
    this.ensureInitialized();
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
    this.ensureInitialized();
    return this.auth.startDeviceAuthorization();
  }

  /**
   * Polls the token endpoint to obtain tokens for the device authorization flow.
   * @param device_code The device code obtained from device authorization.
   * @param interval Polling interval in seconds.
   * @param timeout Maximum time to wait in milliseconds.
   */
  public async pollDeviceToken(
    device_code: string,
    interval: number = 5,
    timeout?: number,
  ): Promise<void> {
    this.ensureInitialized();
    return this.auth.pollDeviceToken(device_code, interval, timeout);
  }

  /**
   * Retrieves the current access token, refreshing it if necessary.
   * @returns The access token or null if not available.
   */
  public async getAccessToken(): Promise<string | null> {
    this.ensureInitialized();
    return this.tokenClient.getAccessToken();
  }

  /**
   * Retrieves all stored tokens.
   * @returns The token response or null if no tokens are stored.
   */
  public getTokens(): ITokenResponse | null {
    this.ensureInitialized();
    return this.tokenClient.getTokens();
  }

  /**
   * Clears all stored tokens.
   */
  public clearTokens(): void {
    this.ensureInitialized();
    this.tokenClient.clearTokens();
  }

  /**
   * Initiates the logout flow.
   * @param idTokenHint Optional ID token to hint the logout request.
   * @returns The logout URL to which the user should be redirected.
   */
  public async logout(idTokenHint?: string): Promise<string> {
    this.ensureInitialized();
    const logoutUrl = await this.auth.getLogoutUrl(idTokenHint);
    this.logger.info('Logout initiated', { logoutUrl });
    return logoutUrl;
  }
}
