// src/decorators/oidcCallback.ts

import { StatusCode } from '../enums';
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
  request: IRequest,
  response: IResponse,
): { code: string; state: string } | void => {
  if (!request || !request.query) {
    if (response) {
      response
        .status(StatusCode.BAD_REQUEST)
        .send('Invalid callback parameters: Missing request or query.');
    }
    return;
  }

  const { code, state } = request.query;

  if (!code || !state) {
    if (response) {
      response
        .status(StatusCode.BAD_REQUEST)
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
    response
      .status(StatusCode.INTERNAL_SERVER_ERROR)
      .send('Authentication failed');
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

  try {
    // Exchange code for tokens and validate ID token
    await client.handleRedirect(code, state, context);

    // Retrieve user information
    const user = await client.getUserInfo();

    if (client.getConfig().session) {
      // Initialize session if it doesn't exist
      if (!request.session) {
        request.setSession({ state: {}, user: undefined });
      }
      // Ensure state object exists
      if (!request.session.state) {
        request.session.state = {};
      }

      // Attach user to session
      request.setSession({ user });
    }

    // Redirect to the specified URI after successful login
    response.redirect(options?.postLoginRedirectUri ?? '/');
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
    await client.handleRedirect(code, state, context);
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
            .status(StatusCode.BAD_REQUEST)
            .send('Invalid callback parameters: Missing request or response.');
        }
        return;
      }

      const client: Client = this.client;
      const context: IStoreContext = { request: req, response: res };

      const params = validateCallbackParams(req, res);
      if (!params) {
        return;
      }

      const { code, state } = params;

      try {
        if (client.getConfig().session) {
          await processSessionFlow(client, context, code, state, options);
        } else {
          await processStatelessFlow(client, context, code, state, options);
        }
      } catch (error) {
        handleAuthError(error, context, options);
        return;
      }

      // --- New Flow Start Here: Call original handler before redirect ---
      await originalMethod.apply(this, args);

      // Only redirect if headers not already sent
      if (!res.headersSent) {
        res.redirect(options?.postLoginRedirectUri ?? '/');
      }
      // --- End New Flow ---
    };

    return descriptor;
  };
};
