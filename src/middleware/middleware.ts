// src/middleware/middleware.ts

import { Client } from '../classes/Client';
import { MetadataManager } from '../decorators/MetadataManager';
import { IRequest, IRouteMetadata, IStoreContext } from '../interfaces';
import { RequestMethod, RouteAction } from '../enums';
import { ClientError } from '../errors/ClientError';
import { NextFunction } from '../types';

export const middleware = (client: Client) => {
  return async (context: IStoreContext, next: NextFunction) => {
    const { request, response } = context;

    if (!request || !response) {
      await next();
      return;
    }

    const { method, url } = request;
    const { pathname } = new URL(url, `http://${request.headers.get('host')}`);
    const routeMetadata = MetadataManager.getRouteMetadata(
      method as RequestMethod,
      pathname,
    );

    if (!routeMetadata) {
      await next();
      return;
    }

    try {
      await handleRoute(client, context, routeMetadata, next);
    } catch (error) {
      handleError(error, routeMetadata, context);
    }
  };
};

const handleRoute = async (
  client: Client,
  context: IStoreContext,
  metadata: IRouteMetadata,
  next: NextFunction,
) => {
  switch (metadata.action) {
    case RouteAction.Login:
      await handleLogin(client, context);
      break;
    case RouteAction.Callback:
      await handleCallback(client, context, metadata);
      break;
    case RouteAction.Protected:
      await handleProtected(client, context, metadata, next);
      break;
    default:
      await next();
  }
};

const handleLogin = async (client: Client, context: IStoreContext) => {
  const { response } = context;
  const { url: authUrl } = await client.getAuthorizationUrl();
  response.redirect(authUrl);
};

const handleCallback = async (
  client: Client,
  context: IStoreContext,
  metadata: IRouteMetadata,
) => {
  const { request, response } = context;
  const urlParams = new URL(
    request.url,
    `http://${request.headers.get('host')}`,
  ).searchParams;

  const code = urlParams.get('code');
  const state = urlParams.get('state');
  validateCallbackParams(code, state);

  const codeVerifier = client.getConfig().session
    ? validateSession(request, state)
    : null;
  await client.handleRedirect(code, state, codeVerifier, context);

  const user = await client.getUserInfo();
  if (client.getConfig().session) request.session.user = user;

  response.redirect(metadata.postLoginRedirectUri || '/');
};

const handleProtected = async (
  client: Client,
  context: IStoreContext,
  metadata: IRouteMetadata,
  next: NextFunction,
) => {
  const { response } = context;

  const accessToken = await client.getAccessToken();
  if (!accessToken) {
    response.redirect((await client.getAuthorizationUrl()).url);
    return;
  }

  // Retrieve all claims
  const claims = await client.getClaims();

  // Optionally validate specific claims
  validateSpecificClaims(claims, metadata.requiredClaims);

  context.user = await client.getUserInfo();

  await next();
};

const handleError = (
  error: unknown,
  metadata: IRouteMetadata,
  context: IStoreContext,
) => {
  const { response } = context;
  console.error('OIDC Middleware Error:', error);

  if (metadata.onError) {
    metadata.onError(error, context);
  } else {
    response.status(500).send('Authentication failed');
  }
};

const validateCallbackParams = (code: string | null, state: string | null) => {
  if (!code || !state) {
    throw new ClientError(
      'Missing code or state in callback',
      'INVALID_CALLBACK',
    );
  }
};

const validateSession = (request: IRequest, returnedState: string) => {
  const { session } = request;
  if (!session || session.state !== returnedState) {
    throw new ClientError('State mismatch', 'STATE_MISMATCH');
  }

  const codeVerifier = session.codeVerifier;
  if (!codeVerifier) {
    throw new ClientError(
      'Code verifier missing from session',
      'CODE_VERIFIER_MISSING',
    );
  }

  delete session.state;
  delete session.codeVerifier;
  return codeVerifier;
};

const validateSpecificClaims = (
  claims: Record<string, any>,
  requiredClaims?: string[],
) => {
  if (!requiredClaims?.length) return;

  const missingClaims = requiredClaims.filter((claim) => !claims[claim]);
  if (missingClaims.length > 0) {
    throw new ClientError(
      `Missing required claims: ${missingClaims.join(', ')}`,
      'MISSING_CLAIMS',
    );
  }
};
