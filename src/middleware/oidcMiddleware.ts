// src/middleware/oidcMiddleware.ts

import { Client } from '../classes/Client';
import { MetadataManager } from '../decorators/MetadataManager';
import { IRouteMetadata, IStoreContext } from '../interfaces';
import { RequestMethod, RouteAction } from '../enums';
import { ClientError } from '../errors/ClientError';

export const oidcMiddleware = (client: Client) => {
  return async (context: IStoreContext, next: () => Promise<void>) => {
    const { request, response } = context;

    if (!request || !response) {
      await next();
      return;
    }

    // Extract HTTP method and path from the request
    const method = request.method as RequestMethod;
    const url = new URL(request.url, `http://${request.headers.get('host')}`);
    const path = url.pathname;

    // Retrieve metadata for the current route
    const routeMetadata = MetadataManager.getRouteMetadata(method, path);

    if (!routeMetadata) {
      // No OIDC metadata for this route, proceed normally
      await next();
      return;
    }

    try {
      switch (routeMetadata.action) {
        case RouteAction.Login:
          await handleLoginRoute(client, context, routeMetadata);
          break;
        case RouteAction.Callback:
          await handleCallbackRoute(client, context, routeMetadata);
          break;
        case RouteAction.Protected:
          await handleProtectedRoute(client, context, routeMetadata, next);
          break;
        default:
          await next();
      }
    } catch (error) {
      console.error('OIDC Middleware Error:', error);
      if (routeMetadata.onError) {
        routeMetadata.onError(error, context);
      } else {
        response.status(500).send('Authentication failed');
      }
    }
  };
};

// Handler for Login Routes
const handleLoginRoute = async (
  client: Client,
  context: IStoreContext,
  metadata: IRouteMetadata,
) => {
  const { response } = context;

  // Get authorization URL with state and codeVerifier
  const { url: authUrl } = await client.getAuthorizationUrl();

  // Redirect to authorization URL
  response.redirect(authUrl);
};

// Handler for Callback Routes
const handleCallbackRoute = async (
  client: Client,
  context: IStoreContext,
  metadata: IRouteMetadata,
) => {
  const { request, response } = context;

  // Extract query parameters from the URL
  const url = new URL(request.url, `http://${request.headers.get('host')}`);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (!code || !returnedState) {
    throw new ClientError(
      'Missing code or state in callback',
      'INVALID_CALLBACK',
    );
  }

  // Handle the redirect by exchanging code for tokens
  await client.handleRedirect(code, returnedState, context);

  // Optionally, redirect to a post-login URI
  const redirectUri = client.getConfig().postLogoutRedirectUri || '/';
  response.redirect(redirectUri);
};

// Handler for Protected Routes
const handleProtectedRoute = async (
  client: Client,
  context: IStoreContext,
  metadata: IRouteMetadata,
  next: () => Promise<void>,
) => {
  const { response } = context;

  // Check if the user is authenticated
  const accessToken = await client.getAccessToken();
  if (!accessToken) {
    // Not authenticated, initiate login
    const { url: authUrl } = await client.getAuthorizationUrl();

    // Redirect to authorization URL
    response.redirect(authUrl);
    return;
  }

  // Optionally, verify scopes or claims based on metadata
  if (metadata.requiredScopes && metadata.requiredScopes.length > 0) {
    const userInfo = await client.getUserInfo();
    const hasAllScopes = metadata.requiredScopes.every((scope) =>
      userInfo.scope?.includes(scope),
    );
    if (!hasAllScopes) {
      throw new ClientError('Insufficient scopes', 'INSUFFICIENT_SCOPES');
    }
  }

  // Proceed to the next middleware or route handler
  await next();
};
