import { Client } from '../classes/Client';
import { MetadataManager } from '../decorators/MetadataManager';
import {
  IRequest,
  IResponse,
  IRouteMetadata,
  IStoreContext,
} from '../interfaces';
import { RequestMethod, RouteAction } from '../enums';
import { ClientError } from '../errors/ClientError';
import { NextFunction } from '../types';

/**
 * Middleware function compatible with Express.
 *
 * @param {Client} client - The OIDC client instance.
 * @returns {Function} Express-compatible middleware function.
 */
export const middleware = (client: Client) => {
  return async (req?: IRequest, res?: IResponse, next?: NextFunction) => {
    if (!req || !res) {
      if (next) next();
      return;
    }
    // Construct route metadata
    const { method, url } = req;
    let pathname: string;

    try {
      pathname = new URL(url, `http://${req.headers['host']}`).pathname;
    } catch (error) {
      console.error('Invalid URL:', url);
      await next(error);
      return;
    }

    const routeMetadata = MetadataManager.getRouteMetadata(
      method as RequestMethod,
      pathname,
    );

    if (!routeMetadata) {
      await next();
      return;
    }

    try {
      const context: IStoreContext = {
        request: req,
        response: res,
        extra: {}, // Populate as needed
        user: undefined,
      };
      await handleRoute(client, req, res, routeMetadata, next, context);
    } catch (error) {
      await handleError(error, routeMetadata, req, res, next);
    }
  };
};

/**
 * Handles routing based on route metadata.
 *
 * @param {Client} client
 * @param {IRequest} req
 * @param {IResponse} res
 * @param {IRouteMetadata} metadata
 * @param {NextFunction} next
 * @param {IStoreContext} context
 */
const handleRoute = async (
  client: Client,
  req: IRequest,
  res: IResponse,
  metadata: IRouteMetadata,
  next: NextFunction,
  context: IStoreContext,
) => {
  switch (metadata.action) {
    case RouteAction.Login:
      await handleLogin(client, res);
      break;
    case RouteAction.Callback:
      await handleCallback(client, req, res, metadata, next, context);
      break;
    case RouteAction.Protected:
      await handleProtected(client, req, res, metadata, next, context);
      break;
    default:
      await next();
  }
};

/**
 * Handles login action.
 *
 * @param {Client} client
 * @param {IResponse} res
 */
const handleLogin = async (client: Client, res: IResponse) => {
  const { url: authUrl } = await client.getAuthorizationUrl();
  res.redirect(authUrl);
};

/**
 * Handles callback action.
 *
 * @param {Client} client
 * @param {IRequest} req
 * @param {IResponse} res
 * @param {IRouteMetadata} metadata
 * @param {NextFunction} next
 * @param {IStoreContext} context
 */
const handleCallback = async (
  client: Client,
  req: IRequest,
  res: IResponse,
  metadata: IRouteMetadata,
  next: NextFunction,
  context: IStoreContext,
) => {
  const urlParams = new URL(req.url, `http://${req.headers.get('host')}`)
    .searchParams;

  const code = urlParams.get('code');
  const state = urlParams.get('state');
  validateCallbackParams(code, state);

  const codeVerifier = client.getConfig().session
    ? validateSession(req, state)
    : null;

  await client.handleRedirect(code!, state!, codeVerifier, context);

  const user = await client.getUserInfo();
  if (client.getConfig().session) {
    context.user = user;
    req.session = {
      ...req.session,
      user,
    };
  }

  res.redirect(metadata.postLoginRedirectUri || '/');
};

/**
 * Handles protected routes.
 *
 * @param {Client} client
 * @param {IRequest} req
 * @param {IResponse} res
 * @param {IRouteMetadata} metadata
 * @param {NextFunction} next
 * @param {IStoreContext} context
 */
const handleProtected = async (
  client: Client,
  req: IRequest,
  res: IResponse,
  metadata: IRouteMetadata,
  next: NextFunction,
  context: IStoreContext,
) => {
  const accessToken = await client.getAccessToken();
  if (!accessToken) {
    const authUrl = (await client.getAuthorizationUrl()).url;
    res.redirect(authUrl);
    return;
  }

  // Retrieve all claims
  const claims = await client.getClaims();

  // Optionally validate specific claims
  validateSpecificClaims(claims, metadata.requiredClaims);

  const user = await client.getUserInfo();
  context.user = user;
  req.session = {
    ...req.session,
    user,
  };

  await next();
};

/**
 * Handles errors in middleware.
 *
 * @param {unknown} error
 * @param {IRouteMetadata} metadata
 * @param {IRequest} req
 * @param {IResponse} res
 * @param {NextFunction} next
 */
const handleError = async (
  error: unknown,
  metadata: IRouteMetadata,
  req: IRequest,
  res: IResponse,
  next: NextFunction,
) => {
  console.error('OIDC Middleware Error:', error);

  if (metadata.onError) {
    metadata.onError(error, req, res);
  } else {
    res.status(500).send('Authentication failed');
  }

  // Pass the error to the next middleware
  await next(error);
};

/**
 * Validates callback parameters.
 *
 * @param {string | null} code
 * @param {string | null} state
 */
const validateCallbackParams = (code: string | null, state: string | null) => {
  if (!code || !state) {
    throw new ClientError(
      'Missing code or state in callback',
      'INVALID_CALLBACK',
    );
  }
};

/**
 * Validates session data.
 *
 * @param {IRequest} req
 * @param {string} returnedState
 * @returns {string}
 */
const validateSession = (req: IRequest, returnedState: string): string => {
  const { session } = req;
  if (!session || !session.state || !session.state[returnedState]) {
    throw new ClientError(
      'State mismatch or state not found in session',
      'STATE_MISMATCH',
    );
  }

  const stateEntry = session.state[returnedState];
  const codeVerifier = stateEntry.codeVerifier;
  if (!codeVerifier) {
    throw new ClientError(
      'Code verifier missing from session state',
      'CODE_VERIFIER_MISSING',
    );
  }

  // Remove the specific state entry from the session
  delete session.state[returnedState];

  return codeVerifier;
};

/**
 * Validates specific claims.
 *
 * @param {Record<string, any>} claims
 * @param {string[] | undefined} requiredClaims
 */
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
