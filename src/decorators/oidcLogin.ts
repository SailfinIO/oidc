// src/decorators/oidcLogin.ts

import { Client } from '../classes/Client';
import { IStoreContext } from '../interfaces';

/**
 * Options for the oidcLogin decorator.
 */
export interface OidcLoginOptions {
  /**
   * The URL to redirect to after successful authentication.
   * Defaults to '/' if not provided.
   */
  postLoginRedirectUri?: string;

  /**
   * Optional custom error handler.
   */
  onError?: (error: any, context: IStoreContext) => void;
}

/**
 * Initiates the OIDC login flow by redirecting the user to the authorization URL.
 *
 * @param client - An instance of the OIDC Client.
 * @param options - Optional settings.
 * @returns A higher-order function that wraps the original route handler.
 */
export const OidcLogin = (client: Client, options?: OidcLoginOptions) => {
  return async (context: IStoreContext): Promise<void> => {
    const { request, response } = context;

    if (!request || !response) {
      throw new Error(
        'Request and Response objects are required in IStoreContext',
      );
    }

    try {
      // Get the authorization URL, state, and codeVerifier
      const { url, state, codeVerifier } = await client.getAuthorizationUrl();

      // Store the state and codeVerifier in the session for CSRF protection and PKCE
      if (client.getConfig().session) {
        request.session = request.session || {
          cookie: { access_token: '', token_type: '', expires_in: 0 },
        };
        request.session.state = state;
        if (codeVerifier) {
          request.session.codeVerifier = codeVerifier;
        }
      }

      // Redirect the user to the authorization URL
      response.redirect(url);
    } catch (error) {
      console.error('OIDC Login Error:', error);
      if (options?.onError) {
        options.onError(error, context);
      } else {
        response.status(500).send('Authentication initiation failed');
      }
    }
  };
};
