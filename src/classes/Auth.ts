// src/clients/Auth.ts

import { Token } from './Token';
import { ClientError } from '../errors/ClientError';
import {
  buildAuthorizationUrl,
  buildLogoutUrl,
  buildUrlEncodedBody,
  parseFragment,
  sleep,
  generateRandomString,
  Logger,
} from '../utils';
import {
  ILogoutUrlParams,
  ITokenResponse,
  IHttp,
  IIssuer,
  ILogger,
  IToken,
  IClientConfig,
  ClientMetadata,
  IAuth,
  IPkce,
  IState,
} from '../interfaces';
import { GrantType } from '../enums/GrantType';
import { PkceMethod } from '../enums';
import { JwtValidator } from './JwtValidator';
import { Pkce } from './Pkce';
import { State } from './State';

export class Auth implements IAuth {
  private readonly config: IClientConfig;
  private readonly issuer: IIssuer;
  private readonly tokenClient: IToken;
  private readonly logger: ILogger;
  private readonly httpClient: IHttp;
  private readonly pkceService: IPkce;
  private readonly state: IState;

  private codeVerifier: string | null = null;

  constructor(
    config: IClientConfig,
    logger: ILogger,
    issuer: IIssuer,
    httpClient: IHttp,
    tokenClient?: IToken,
    pkceService?: IPkce,
  ) {
    this.config = config;
    this.logger = logger;
    this.httpClient = httpClient;
    this.issuer = issuer;
    this.tokenClient =
      tokenClient ||
      new Token(this.logger, this.config, this.issuer, this.httpClient);
    this.pkceService = pkceService || new Pkce(this.config);
    this.state = new State();
  }

  /**
   * Generates the authorization URL to initiate the OAuth2/OIDC flow.
   * Generates and stores state and nonce internally.
   * @returns The authorization URL and the generated state.
   */
  public async getAuthorizationUrl(): Promise<{ url: string; state: string }> {
    const state = generateRandomString();
    const nonce = generateRandomString();

    // Store state -> nonce mapping
    this.state.addState(state, nonce);

    const { url, codeVerifier } = await this.generateAuthUrl(state, nonce);

    if (codeVerifier) {
      this.codeVerifier = codeVerifier;
    }

    return { url, state };
  }

  /**
   * Generates the authorization URL with the provided state and nonce.
   * @param state A unique state string for CSRF protection.
   * @param nonce Optional nonce for ID token validation.
   * @returns The authorization URL and the code verifier if PKCE is used.
   */
  private async generateAuthUrl(
    state: string,
    nonce?: string,
  ): Promise<{ url: string; codeVerifier?: string }> {
    const client: ClientMetadata = await this.issuer.discoverClient();
    this.ensureGrantTypeSupportsAuthUrl();

    const { codeVerifier, codeChallenge } =
      this.config.pkce && this.config.grantType === GrantType.AuthorizationCode
        ? this.pkceService.generatePkce()
        : { codeVerifier: undefined, codeChallenge: undefined };

    const url = buildAuthorizationUrl(
      {
        authorizationEndpoint: client.authorization_endpoint,
        clientId: this.config.clientId,
        redirectUri: this.config.redirectUri,
        responseType: this.config.responseType || 'code',
        scope: this.config.scopes.join(' '),
        state,
        codeChallenge,
        codeChallengeMethod:
          codeChallenge && this.config.pkceMethod !== PkceMethod.Plain
            ? this.config.pkceMethod || PkceMethod.S256
            : undefined,
      },
      nonce ? { nonce } : undefined,
    );

    this.logger.debug('Authorization URL generated', { url });
    return { url, codeVerifier };
  }

  /**
   * Handles the redirect callback for authorization code flow.
   * Exchanges the authorization code for tokens and validates the ID token.
   * @param code The authorization code received from the provider.
   * @param returnedState The state returned in the redirect to validate against CSRF.
   */
  public async handleRedirect(
    code: string,
    returnedState: string,
  ): Promise<void> {
    const expectedNonce = await this.state.getNonce(returnedState);
    if (!expectedNonce) {
      throw new ClientError(
        'State does not match or not found',
        'STATE_MISMATCH',
      );
    }

    // Exchange code for tokens
    await this.tokenClient.exchangeCodeForToken(code, this.codeVerifier);

    this.codeVerifier = null;

    // Validate ID token if present
    const tokens = this.tokenClient.getTokens();
    const client = await this.issuer.discoverClient();
    if (tokens?.id_token) {
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
   *
   * This method processes the authorization response by extracting tokens directly
   * from the URL fragment, validates the returned state, and stores the tokens securely.
   *
   * @param {string} fragment - The URL fragment containing tokens (e.g., access_token, id_token).
   * @returns {Promise<void>} Resolves when tokens are successfully extracted and stored.
   *
   * @throws {ClientError} If token extraction fails or state validation fails.
   */
  public async handleRedirectForImplicitFlow(fragment: string): Promise<void> {
    // Parse the fragment into an object
    const params = parseFragment(fragment);

    // Handle potential OAuth2 errors
    if (params.error) {
      this.logger.error('Error in implicit flow redirect', {
        error: params.error,
        error_description: params.error_description,
      });
      throw new ClientError(
        params.error_description || 'Implicit flow error',
        params.error.toUpperCase() as string,
      );
    }

    const { access_token, id_token, state, token_type, expires_in } = params;

    if (!access_token) {
      throw new ClientError(
        'Access token not found in fragment',
        'TOKEN_NOT_FOUND',
      );
    }

    if (!state) {
      throw new ClientError(
        'State parameter missing in fragment',
        'STATE_MISSING',
      );
    }

    const expectedNonce = await this.state.getNonce(state);
    if (!expectedNonce) {
      throw new ClientError(
        'State does not match or not found',
        'STATE_MISMATCH',
      );
    }

    // Optionally handle ID token validation
    if (id_token) {
      const client = await this.issuer.discoverClient();
      const jwtValidator = new JwtValidator(
        this.logger as Logger,
        client,
        this.config.clientId,
      );
      await jwtValidator.validateIdToken(id_token, expectedNonce);
      this.logger.info('ID token validated successfully');
    } else {
      this.logger.warn('No ID token returned to validate');
    }
    // Convert expires_in from string to number
    const expiresInNumber = expires_in ? parseInt(expires_in, 10) : undefined;

    // Store the tokens
    this.tokenClient.setTokens({
      access_token,
      id_token,
      token_type,
      expires_in: expiresInNumber,
    });

    this.logger.info('Tokens obtained and stored successfully');

    this.codeVerifier = null;
  }

  /**
   * Ensures the current grant type supports generating an authorization URL.
   * @throws {ClientError} If the grant type is unsupported.
   */
  private ensureGrantTypeSupportsAuthUrl(): void {
    const supportedGrantTypes = [
      GrantType.AuthorizationCode,
      GrantType.Implicit,
      GrantType.DeviceCode,
    ];
    if (!supportedGrantTypes.includes(this.config.grantType)) {
      throw new ClientError(
        `Grant type ${this.config.grantType} does not support authorization URLs.`,
        'INVALID_GRANT_TYPE',
      );
    }
  }

  /**
   * Retrieves the previously generated code verifier.
   * @returns The code verifier if available.
   */
  public getCodeVerifier(): string | null {
    return this.codeVerifier;
  }

  /**
   * Initiates the device authorization request to obtain device and user codes.
   * @returns Device authorization details.
   * @throws {ClientError} If device authorization initiation fails.
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

    const client: ClientMetadata = await this.issuer.discoverClient();
    const deviceEndpoint = client.device_authorization_endpoint;

    if (!deviceEndpoint) {
      const error = new ClientError(
        'No device_authorization_endpoint found in discovery configuration.',
        'ENDPOINT_MISSING',
      );
      this.logger.error('Failed to start device authorization', {
        error: error,
      });
      throw new ClientError(
        'Device authorization failed',
        'DEVICE_AUTH_ERROR',
        {
          originalError: error,
        },
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
   * Polls the token endpoint until the device is authorized or the process times out.
   * @param device_code The device code obtained from device authorization.
   * @param interval Polling interval in seconds.
   * @param timeout Maximum time to wait in milliseconds.
   * @throws {ClientError} If polling fails or times out.
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

    const client: ClientMetadata = await this.issuer.discoverClient();
    const tokenEndpoint = client.token_endpoint;
    const startTime = Date.now();

    while (true) {
      if (timeout && Date.now() - startTime > timeout) {
        const timeoutError = new ClientError(
          'Device code polling timed out',
          'TIMEOUT_ERROR',
        );
        this.logger.error('Device token polling timed out', {
          error: timeoutError,
        });
        throw timeoutError;
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
        const tokenResponse: ITokenResponse = JSON.parse(response);
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
            this.logger.warn('Error response from token endpoint', {
              response: error.context.body,
            });
          }
        }

        switch (errorBody.error) {
          case 'authorization_pending':
            await sleep(interval * 1000);
            break;
          case 'slow_down':
            interval += 5;
            await sleep(interval * 1000);
            break;
          case 'expired_token':
            const expiredTokenError = new ClientError(
              'Device code expired',
              'DEVICE_CODE_EXPIRED',
            );
            this.logger.error('Device code expired', {
              error: expiredTokenError,
            });
            throw expiredTokenError;
          default:
            const pollingError = new ClientError(
              'Device token polling failed',
              'TOKEN_POLLING_ERROR',
              {
                originalError: error,
              },
            );
            this.logger.error('Device token polling failed', {
              originalError: error,
            });
            throw pollingError;
        }
      }
    }
  }

  /**
   * Generates the logout URL to initiate the logout flow.
   * @param idTokenHint Optional ID token to hint the logout request.
   * @param state Optional state for logout.
   * @returns The logout URL.
   * @throws {ClientError} If logout endpoint is missing.
   */
  public async getLogoutUrl(
    idTokenHint?: string,
    state?: string,
  ): Promise<string> {
    const client: ClientMetadata = await this.issuer.discoverClient();
    const endSessionEndpoint = client.end_session_endpoint;

    if (!endSessionEndpoint) {
      const error = new ClientError(
        'No end_session_endpoint found in discovery configuration.',
        'END_SESSION_ENDPOINT_MISSING',
      );
      this.logger.error('Failed to generate logout URL', { error });
      throw error;
    }

    const logoutParams: ILogoutUrlParams = {
      endSessionEndpoint,
      clientId: this.config.clientId,
      postLogoutRedirectUri: this.config.postLogoutRedirectUri,
      idTokenHint,
      state,
    };

    const logoutUrl = buildLogoutUrl(logoutParams);

    this.logger.debug('Logout URL generated', { logoutUrl });
    return logoutUrl;
  }
}
