// src/clients/Auth.ts

import { Token } from './Token';
import { ClientError } from '../errors/ClientError';
import {
  buildAuthorizationUrl,
  buildLogoutUrl,
  buildUrlEncodedBody,
  sleep,
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
} from '../interfaces';
import { GrantType } from '../enums/GrantType';
import { createHash, randomBytes } from 'crypto';
import { Algorithm } from '../enums/Algorithm';
import { BinaryToTextEncoding } from '../enums/BinaryToTextEncoding';
import { PkceMethod } from '../enums';

export class Auth implements IAuth {
  private readonly config: IClientConfig;
  private readonly issuer: IIssuer;
  private readonly tokenClient: IToken;
  private readonly logger: ILogger;
  private readonly httpClient: IHttp;

  private codeVerifier: string | null = null;

  constructor(
    config: IClientConfig,
    logger: ILogger,
    issuer: IIssuer,
    httpClient: IHttp,
    tokenClient?: IToken,
  ) {
    this.config = config;
    this.logger = logger;
    this.httpClient = httpClient;
    this.issuer = issuer;
    this.tokenClient =
      tokenClient ||
      new Token(this.logger, this.config, this.issuer, this.httpClient);
  }

  /**
   * Generates the authorization URL to initiate the OAuth2/OIDC flow.
   * @param state A unique state string for CSRF protection.
   * @param nonce Optional nonce for ID token validation.
   * @returns The authorization URL and the code verifier if PKCE is used.
   */
  public async getAuthorizationUrl(
    state: string,
    nonce?: string,
  ): Promise<{ url: string; codeVerifier?: string }> {
    const client: ClientMetadata = await this.issuer.discoverClient();
    this.ensureGrantTypeSupportsAuthUrl();

    const { codeVerifier, codeChallenge } =
      this.config.pkce && this.config.grantType === GrantType.AuthorizationCode
        ? this.generatePkce()
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
          codeChallenge && this.config.pkceMethod !== 'plain'
            ? this.config.pkceMethod || PkceMethod.S256
            : undefined,
      },
      nonce ? { nonce } : undefined,
    );

    this.logger.debug('Authorization URL generated', { url });
    return { url, codeVerifier };
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
   * Generates PKCE code verifier and code challenge.
   * @returns An object containing the code verifier and code challenge.
   */
  private generatePkce(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = this.generateCodeVerifier();
    this.codeVerifier = codeVerifier;
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generates a random code verifier for PKCE.
   * @returns The generated code verifier string.
   */
  private generateCodeVerifier(): string {
    return randomBytes(32).toString(BinaryToTextEncoding.BASE_64_URL);
  }

  /**
   * Generates a code challenge based on the code verifier and PKCE method.
   * @param verifier The code verifier string.
   * @returns The generated code challenge string.
   */
  private generateCodeChallenge(verifier: string): string {
    if (this.config.pkceMethod === PkceMethod.Plain) {
      return verifier;
    }

    return createHash(Algorithm.SHA256.toLowerCase())
      .update(verifier)
      .digest(BinaryToTextEncoding.BASE_64_URL);
  }

  /**
   * Retrieves the previously generated code verifier.
   * @returns The code verifier if available.
   */
  public getCodeVerifier(): string | null {
    return this.codeVerifier;
  }

  /**
   * Exchanges an authorization code for tokens.
   * @param code The authorization code received from the authorization server.
   * @param codeVerifier Optional code verifier if PKCE is used.
   * @param username Optional username for Resource Owner Password Credentials grant.
   * @param password Optional password for Resource Owner Password Credentials grant.
   * @throws {ClientError} If the exchange fails.
   */
  public async exchangeCodeForToken(
    code: string,
    codeVerifier?: string,
    username?: string,
    password?: string,
  ): Promise<void> {
    const client: ClientMetadata = await this.issuer.discoverClient();
    const tokenEndpoint = client.token_endpoint;

    const params = this.buildTokenRequestParams(
      code,
      codeVerifier,
      username,
      password,
    );

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const body = buildUrlEncodedBody(params);

    try {
      const response = await this.httpClient.post(tokenEndpoint, body, headers);
      const tokenResponse: ITokenResponse = JSON.parse(response);
      this.tokenClient.setTokens(tokenResponse);
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

  /**
   * Builds the parameters for the token request based on the grant type.
   * @param code The code or token being exchanged.
   * @param codeVerifier Optional code verifier.
   * @param username Optional username for password grant.
   * @param password Optional password for password grant.
   * @returns The parameters as a record of strings.
   */
  private buildTokenRequestParams(
    code: string,
    codeVerifier?: string,
    username?: string,
    password?: string,
  ): Record<string, string> {
    let params: Record<string, string> = {
      grant_type: this.config.grantType,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      ...(this.config.clientSecret && {
        client_secret: this.config.clientSecret,
      }),
    };

    switch (this.config.grantType) {
      case GrantType.AuthorizationCode:
        params = {
          ...params,
          code,
          ...(codeVerifier && { code_verifier: codeVerifier }),
        };
        break;
      case GrantType.RefreshToken:
        params = { ...params, refresh_token: code };
        break;
      case GrantType.Password:
        if (!username || !password) {
          throw new ClientError(
            'Username and password are required for Password grant type',
            'INVALID_REQUEST',
          );
        }
        params = { ...params, username, password };
        break;
      case GrantType.DeviceCode:
        params = { ...params, device_code: code };
        break;
      case GrantType.JWTBearer:
        params = {
          ...params,
          assertion: code,
          scope: this.config.scopes.join(' '),
        };
        break;
      case GrantType.SAML2Bearer:
        params = { ...params, assertion: code };
        break;
      case GrantType.ClientCredentials:
        // No additional params
        break;
      case GrantType.Custom:
        // Handle custom grant types
        break;
      default:
        throw new ClientError(
          `Unsupported grant type: ${this.config.grantType}`,
          'UNSUPPORTED_GRANT_TYPE',
        );
    }

    return params;
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
