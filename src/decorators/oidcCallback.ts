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
 * Validate callback parameters.
 */
const validateCallbackParams = (
  request: any,
  response: any,
): { code: string; state: string } | void => {
  const code = request.query.code as string;
  const state = request.query.state as string;

  if (!code || !state) {
    response.status(400).send('Invalid callback parameters');
    return;
  }

  return { code, state };
};

/**
 * Handle authentication errors.
 */
const handleAuthError = (
  error: any,
  context: IStoreContext,
  options?: OidcCallbackOptions,
) => {
  console.error('OIDC Callback Error:', error);
  const { response } = context;

  if (options?.onError) {
    options.onError(error, context);
  } else {
    response.status(500).send('Authentication failed');
  }
};

/**
 * Process the session-based OIDC flow.
 */
const processSessionFlow = async (
  client: Client,
  context: IStoreContext,
  code: string,
  state: string,
  options?: OidcCallbackOptions,
) => {
  const { request, response } = context;
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

  delete request.session.state;
  delete request.session.codeVerifier;

  const storeContext = { request, response };

  try {
    await client.handleRedirect(code, state, codeVerifier, storeContext);
    const user = await client.getUserInfo();

    request.session.user = user;
    response.redirect(options?.postLoginRedirectUri || '/');
  } catch (error) {
    handleAuthError(error, context, options);
  }
};

/**
 * Process the stateless OIDC flow.
 */
const processStatelessFlow = async (
  client: Client,
  context: IStoreContext,
  code: string,
  state: string,
  options?: OidcCallbackOptions,
) => {
  const { response } = context;

  try {
    await client.handleRedirect(code, state, null, context);
    await client.getUserInfo();
    response.redirect(options?.postLoginRedirectUri || '/');
  } catch (error) {
    handleAuthError(error, context, options);
  }
};

/**
 * Handles the OIDC callback by processing the authorization code,
 * exchanging it for tokens, and establishing a session.
 *
 * @param client - An instance of the OIDC Client.
 * @param options - Optional settings.
 * @returns A higher-order function that wraps the original route handler.
 */
export const OidcCallback = (client: Client, options?: OidcCallbackOptions) => {
  return async (context: IStoreContext): Promise<void> => {
    const { request, response } = context;

    if (!request || !response) {
      throw new Error(
        'Request and Response objects are required in IStoreContext',
      );
    }

    const params = validateCallbackParams(request, response);
    if (!params) return;

    const { code, state } = params;
    const config = client.getConfig();

    if (config.session) {
      await processSessionFlow(client, context, code, state, options);
    } else {
      await processStatelessFlow(client, context, code, state, options);
    }
  };
};
