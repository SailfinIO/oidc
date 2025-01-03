// src/decorators/oidcLogin.ts

import { Client } from '../classes/Client';
import { IRequest, IResponse, IStoreContext } from '../interfaces';
import { MetadataManager } from './MetadataManager';

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
 * Handle login errors.
 */
const handleLoginError = (
  error: any,
  context: IStoreContext,
  options?: OidcLoginOptions,
) => {
  console.error('OIDC Login Error:', error);
  const { response } = context;

  if (options?.onError) {
    options.onError(error, context);
  } else {
    response.status(500).send('Authentication initiation failed');
  }
};

/**
 * Process the OIDC login flow.
 */
const processLoginFlow = async (
  client: Client,
  context: IStoreContext,
  options?: OidcLoginOptions,
) => {
  const { request, response } = context;

  try {
    const { url, state, codeVerifier } = await client.getAuthorizationUrl();

    // Check if session management is enabled
    if (client.getConfig().session) {
      // Initialize session if it's not present
      if (!request.session) {
        request.session = {};
      }

      // Set state and codeVerifier in session
      request.session.state = state;
      if (codeVerifier) {
        request.session.codeVerifier = codeVerifier;
      }
    }

    // Redirect the user to the authorization URL
    return response.redirect(url);
  } catch (error) {
    handleLoginError(error, context, options);
  }
};

/**
 * Decorator to initiate OIDC login flow.
 */
export const OidcLogin = (options?: OidcLoginOptions): MethodDecorator => {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    // Attach metadata indicating this method is an OIDC login handler
    MetadataManager.setMethodMetadata(
      target.constructor,
      propertyKey as string,
      {
        isOidcLogin: true,
        ...options,
      },
    );

    descriptor.value = async function (
      this: { client: Client },
      ...args: any[]
    ) {
      const req: IRequest = args[0];
      const res: IResponse = args[1];

      // Retrieve the injected OIDC client from 'this' (the controller instance)
      const client: Client = this.client;

      // Build the store context for your dryness helpers
      const context: IStoreContext = { request: req, response: res };

      try {
        // Process the login flow
        await processLoginFlow(client, context, options);
      } catch (error) {
        // Handle any unexpected errors
        handleLoginError(error, context, options);
      }

      // Optionally call the original method if you want to execute additional logic after login
      // For example, logging or additional response modifications
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
};
