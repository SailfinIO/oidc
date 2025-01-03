// src/decorators/oidcCallback.ts

import { Client } from '../classes/Client';
import { IRequest, IResponse, IStoreContext } from '../interfaces';
import { MetadataManager } from './MetadataManager';

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
  if (!request || !request.query) {
    if (response) {
      response
        .status(400)
        .send('Invalid callback parameters: Missing request or query.');
    }
    return;
  }

  const code = request.query.code as string;
  const state = request.query.state as string;

  if (!code || !state) {
    if (response) {
      response
        .status(400)
        .send('Invalid callback parameters: Missing code or state.');
    }
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
export const OidcCallback = (
  options?: OidcCallbackOptions,
): MethodDecorator => {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    MetadataManager.setMethodMetadata(
      target.constructor,
      propertyKey as string,
      {
        isOidcCallback: true,
        ...options,
      },
    );

    descriptor.value = async function (
      this: { client: Client },
      ...args: any[]
    ) {
      const req: any = args[0];
      const res: any = args[1];

      if (!req || !res) {
        if (res) {
          res
            .status(400)
            .send('Invalid callback parameters: Missing request or response.');
        }
        return;
      }

      // Retrieve the injected OIDC client from 'this' (the controller instance).
      const client: Client = this.client;

      // Build the store context for your dryness helpers:
      const context: IStoreContext = { request: req, response: res };

      // 1) Validate the callback params (code & state).
      const params = validateCallbackParams(req, res);
      if (!params) {
        // If validateCallbackParams returned void, it already sent a 400 response.
        return;
      }

      // 2) Extract the code and state.
      const { code, state } = params;

      try {
        // 3) Check if sessions are configured. If so, do a session-based flow.
        if (client.getConfig().session) {
          await processSessionFlow(client, context, code, state, options);
        } else {
          await processStatelessFlow(client, context, code, state, options);
        }
      } catch (error) {
        // If an error escaped the dryness flows, handle it here:
        handleAuthError(error, context, options);
      }

      // Optionally call the original method if you want to do something after:
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
};
