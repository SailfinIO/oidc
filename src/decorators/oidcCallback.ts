// src/decorators/oidcCallback.ts

import { Client } from '../classes/Client';
import { IStoreContext } from '../interfaces';

/**
 * Options for the oidcCallback decorator.
 */
export interface OidcCallbackOptions {
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
 * Handles the OIDC callback by processing the authorization code,
 * exchanging it for tokens, and establishing a session.
 *
 * @param client - An instance of the OIDC Client.
 * @param options - Optional settings.
 * @returns A higher-order function that wraps the original route handler.
 */
export const oidcCallback = (client: Client, options?: OidcCallbackOptions) => {
  return async (context: IStoreContext): Promise<void> => {
    const { request, response } = context;

    if (!request || !response) {
      throw new Error(
        'Request and Response objects are required in IStoreContext',
      );
    }

    const code = request.query.code as string;
    const state = request.query.state as string;

    if (!code || !state) {
      response.status(400).send('Invalid callback parameters');
      return;
    }

    // Call getConfig once and store the result
    const config = client.getConfig();

    if (config.session) {
      const storedState = request.session?.state;
      if (state !== storedState) {
        response.status(400).send('State mismatch');
        return;
      }

      const codeVerifier = request.session?.codeVerifier;
      if (!codeVerifier) {
        response.status(400).send('Code verifier missing from session');
        return;
      }

      if (request.session) {
        delete request.session.state;
        delete request.session.codeVerifier;
      }

      const storeContext = {
        request,
        response,
      };

      try {
        await client.handleRedirect(code, state, codeVerifier, storeContext);
        const user = await client.getUserInfo();

        request.session.user = user;

        const redirectUri = options?.postLoginRedirectUri || '/';
        response.redirect(redirectUri);
      } catch (error) {
        console.error('OIDC Callback Error:', error);
        if (options?.onError) {
          options.onError(error, context);
        } else {
          response.status(500).send('Authentication failed');
        }
      }
    } else {
      try {
        await client.handleRedirect(code, state, null, context);
        await client.getUserInfo();

        const redirectUri = options?.postLoginRedirectUri || '/';
        response.redirect(redirectUri);
      } catch (error) {
        console.error('OIDC Callback Error:', error);
        if (options?.onError) {
          options.onError(error, context);
        } else {
          response.status(500).send('Authentication failed');
        }
      }
    }
  };
};
