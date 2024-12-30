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
export function oidcCallback(client: Client, options?: OidcCallbackOptions) {
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

    // Verify state matches the one stored in the session
    if (client.getConfig().session) {
      const storedState = request.session?.state;
      if (state !== storedState) {
        response.status(400).send('State mismatch');
        return;
      }

      // Retrieve codeVerifier from session
      const codeVerifier = request.session?.codeVerifier;
      if (!codeVerifier) {
        response.status(400).send('Code verifier missing from session');
        return;
      }

      // Clear the stored state and codeVerifier
      if (request.session) {
        delete request.session.state;
        delete request.session.codeVerifier;
      }

      // Create storeContext from request and response
      const storeContext = {
        request,
        response,
      };

      try {
        // Handle the redirect with codeVerifier
        await client.handleRedirect(code, state, codeVerifier, storeContext);

        // Retrieve user information
        const user = await client.getUserInfo();

        // Attach user info to the session
        if (client.getConfig().session) {
          request.session.user = user;
        }

        // Determine the redirect URI after successful authentication
        const redirectUri = options?.postLoginRedirectUri || '/';

        // Redirect the user
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
      // If session is not used, proceed without codeVerifier
      try {
        await client.handleRedirect(code, state, null, context);
        const user = await client.getUserInfo();
        // Handle user info as needed

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
}
