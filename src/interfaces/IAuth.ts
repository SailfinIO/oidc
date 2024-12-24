/**
 * @fileoverview
 * Defines the `IAuth` interface for handling authentication flows.
 * This interface provides a contract for implementing OAuth2/OIDC operations,
 * including authorization URL generation, token exchange, device authorization,
 * and logout processes.
 *
 * @module src/interfaces/IAuth
 */

/**
 * Represents the response from generating an authorization URL.
 *
 * @interface IAuthorizationUrlResponse
 */
export interface IAuthorizationUrlResponse {
  /**
   * The generated authorization URL to initiate the OAuth2/OIDC flow.
   */
  url: string;

  /**
   * The code verifier used for PKCE, if applicable.
   */
  codeVerifier?: string;
}

/**
 * Represents the response from initiating device authorization.
 *
 * @interface IDeviceAuthorizationResponse
 */
export interface IDeviceAuthorizationResponse {
  /**
   * The device code issued by the authorization server.
   */
  device_code: string;

  /**
   * The user code that the user must enter to authorize the device.
   */
  user_code: string;

  /**
   * The verification URI where the user can enter the user code.
   */
  verification_uri: string;

  /**
   * The lifetime of the device code in seconds.
   */
  expires_in: number;

  /**
   * The interval in seconds at which the device should poll the token endpoint.
   */
  interval: number;
}

/**
 * Defines the `IAuth` interface for managing authentication flows.
 *
 * The `IAuth` interface provides methods for generating authorization URLs,
 * exchanging authorization codes for tokens, handling device authorization flows,
 * polling for tokens, and generating logout URLs. Implementations of this interface
 * can support various OAuth2/OIDC grant types and PKCE configurations.
 */
export interface IAuth {
  /**
   * Generates the authorization URL to initiate the OAuth2/OIDC flow.
   *
   * This method constructs the URL that the client application should redirect
   * the user to in order to begin the authentication process. It supports PKCE
   * if configured and returns the code verifier when applicable.
   *
   * @param {string} state - A unique state string for CSRF protection.
   * @param {string} [nonce] - Optional nonce for ID token validation.
   * @returns {Promise<IAuthorizationUrlResponse>} An object containing the authorization URL and optional code verifier.
   *
   * @throws {ClientError} If the grant type does not support authorization URLs.
   *
   * @example
   * ```typescript
   * const { url, codeVerifier } = await authClient.getAuthorizationUrl('randomState');
   * window.location.href = url;
   * ```
   */
  getAuthorizationUrl(
    state: string,
    nonce?: string,
  ): Promise<IAuthorizationUrlResponse>;

  /**
   * Retrieves the previously generated PKCE code verifier.
   *
   * This method returns the code verifier that was generated during the authorization
   * URL creation. It is used during the token exchange process to validate the PKCE flow.
   *
   * @returns {string | null} The code verifier if it exists, otherwise `null`.
   *
   * @example
   * ```typescript
   * const codeVerifier = authClient.getCodeVerifier();
   * ```
   */
  getCodeVerifier(): string | null;

  /**
   * Exchanges an authorization code for tokens.
   *
   * This method sends a request to the token endpoint to exchange the provided
   * authorization code for access and ID tokens. It supports PKCE and various
   * grant types, including Resource Owner Password Credentials.
   *
   * @param {string} code - The authorization code received from the authorization server.
   * @param {string} [codeVerifier] - Optional code verifier if PKCE is used.
   * @param {string} [username] - Optional username for Resource Owner Password Credentials grant.
   * @param {string} [password] - Optional password for Resource Owner Password Credentials grant.
   * @returns {Promise<void>} Resolves when tokens are successfully obtained and stored.
   *
   * @throws {ClientError} If the token exchange fails or required parameters are missing.
   *
   * @example
   * ```typescript
   * await authClient.exchangeCodeForToken(authCode, codeVerifier);
   * ```
   */
  exchangeCodeForToken(
    code: string,
    codeVerifier?: string,
    username?: string,
    password?: string,
  ): Promise<void>;

  /**
   * Initiates the device authorization request to obtain device and user codes.
   *
   * This method starts the Device Authorization Grant flow by requesting device
   * and user codes from the authorization server. It is used in scenarios where
   * the client device has limited input capabilities.
   *
   * @returns {Promise<IDeviceAuthorizationResponse>} The device authorization details.
   *
   * @throws {ClientError} If device authorization initiation fails or the grant type is unsupported.
   *
   * @example
   * ```typescript
   * const deviceAuth = await authClient.startDeviceAuthorization();
   * console.log(`Please visit ${deviceAuth.verification_uri} and enter code ${deviceAuth.user_code}`);
   * ```
   */
  startDeviceAuthorization(): Promise<IDeviceAuthorizationResponse>;

  /**
   * Polls the token endpoint until the device is authorized or the process times out.
   *
   * This method repeatedly requests tokens using the device code until the user
   * authorizes the device or the polling process exceeds the specified timeout.
   *
   * @param {string} device_code - The device code obtained from device authorization.
   * @param {number} [interval=5] - Polling interval in seconds.
   * @param {number} [timeout] - Maximum time to wait in milliseconds.
   * @returns {Promise<void>} Resolves when tokens are successfully obtained.
   *
   * @throws {ClientError} If polling fails, the device code expires, or the process times out.
   *
   * @example
   * ```typescript
   * await authClient.pollDeviceToken(deviceAuth.device_code, deviceAuth.interval, 60000);
   * ```
   */
  pollDeviceToken(
    device_code: string,
    interval?: number,
    timeout?: number,
  ): Promise<void>;

  /**
   * Generates the logout URL to initiate the logout flow.
   *
   * This method constructs the URL that the client application should redirect
   * the user to in order to log out from the authentication server. It supports
   * passing an ID token hint and state parameters.
   *
   * @param {string} [idTokenHint] - Optional ID token to hint the logout request.
   * @param {string} [state] - Optional state for logout.
   * @returns {Promise<string>} The generated logout URL.
   *
   * @throws {ClientError} If the logout endpoint is missing in the discovery configuration.
   *
   * @example
   * ```typescript
   * const logoutUrl = await authClient.getLogoutUrl(idToken, 'logoutState');
   * window.location.href = logoutUrl;
   * ```
   */
  getLogoutUrl(idTokenHint?: string, state?: string): Promise<string>;
}
