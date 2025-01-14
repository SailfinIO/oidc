// src/middleware/middleware.ts

import { Client } from '../classes/Client';
import { MetadataManager } from '../decorators/MetadataManager';
import {
  IRequest,
  IResponse,
  IRouteMetadata,
  ISessionData,
  IStoreContext,
} from '../interfaces';
import { RequestMethod, RouteAction, SameSite, SessionMode } from '../enums';
import { ClientError } from '../errors/ClientError';
import { NextFunction } from '../types';
import { Cookie, parseCookies, setCookieHeader } from '../utils';

/**
 * Middleware function compatible with Express.
 *
 * @param {Client} client - The OIDC client instance.
 * @returns {Function} Express-compatible middleware function.
 */
export const middleware = (client: Client) => {
  const csrfMw = csrfMiddleware(client);

  return async (
    req: IRequest,
    res: IResponse,
    next: NextFunction,
  ): Promise<void> => {
    if (!req || !res) {
      return next();
    }

    patchExpressResponseForSetCookie(res);

    await csrfMw(req, res, async (csrfErr) => {
      if (csrfErr) {
        // If CSRF check fails, we won't proceed
        return next(csrfErr);
      }
      let routeMetadata: IRouteMetadata | null = null; // Declare outside

      try {
        // Parse cookies from headers
        req.cookies = parseCookies(req.headers);
        client.getLogger().debug('Parsed cookies', { cookies: req.cookies });

        // Initialize session
        const sessionStore = client.getSessionStore();
        const sessionCookieName =
          client.getConfig().session?.cookie?.name || 'sid';
        let sid = req.cookies[sessionCookieName] || null;
        let sessionData: ISessionData | null = null;

        if (sid && sessionStore) {
          sessionData = await sessionStore.get(sid, {
            request: req,
            response: res,
          });
          if (sessionData) {
            req.session = sessionData;
            client.getLogger().debug('Session loaded', { sid, sessionData });
          } else {
            client.getLogger().warn('Invalid sid, clearing session', { sid });
            sid = null;
          }
        }

        // Continue with existing middleware logic
        const { method, url } = req;
        let pathname: string;

        try {
          const host = Array.isArray(req.headers['host'])
            ? req.headers['host'][0]
            : req.headers['host'] || 'localhost';
          const baseUrl = `http://${host}`;
          pathname = new URL(url, baseUrl).pathname;
        } catch (error) {
          client.getLogger().error('Invalid URL', { url, error });
          await next(error);
          return;
        }

        routeMetadata = MetadataManager.getRouteMetadata(
          method as RequestMethod,
          pathname,
        );

        if (!routeMetadata) {
          await next();
          return;
        }

        const context: IStoreContext = {
          request: req,
          response: res,
          extra: {}, // Populate as needed
          user: undefined,
        };

        client.getLogger().debug('Handling route', { pathname, routeMetadata });

        await handleRoute(client, req, res, routeMetadata, next, context);

        // After handling the route, persist the session
        if (sessionStore) {
          if (sid) {
            // Update existing session
            await sessionStore.touch(sid, req.session, {
              request: req,
              response: res,
            });
            client.getLogger().debug('Session touched', { sid });
          } else if (req.session) {
            // Create new session
            sid = await sessionStore.set(req.session, {
              request: req,
              response: res,
            });
            client
              .getLogger()
              .debug('New session created', { sid, sessionData: req.session });

            // Set session cookie
            const options = client.getConfig().session?.cookie?.options || {
              httpOnly: true,
              secure: true,
              sameSite: SameSite.STRICT,
              path: '/',
              maxAge: 3600, // 1 hour
            };

            const cookie = new Cookie(sessionCookieName, sid, options);

            setCookieHeader(context.response, cookie.serialize());
          }
        }

        // Only call next() if the response hasn't been sent (e.g., no redirect)
        if (!res.redirected) {
          await next();
        }
      } catch (error) {
        // Pass the actual routeMetadata to handleError
        await handleError(error, routeMetadata, req, res, next);
      }
    });
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
      await handleLogin(client, req, res);
      return;
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
const handleLogin = async (client: Client, req: IRequest, res: IResponse) => {
  const {
    url: authUrl,
    state,
    codeVerifier,
  } = await client.getAuthorizationUrl();

  // Initialize session if it doesn't exist
  if (!req.session) {
    req.session = {};
  }
  if (!req.session.state) {
    req.session.state = {};
  }

  // Store state and codeVerifier in session
  req.session.state[state] = { codeVerifier, createdAt: Date.now() };

  res.redirect(authUrl);

  return;
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
  const host = Array.isArray(req.headers['host'])
    ? req.headers['host'][0]
    : req.headers['host'] || 'localhost';
  const baseUrl = `http://${host}`;
  const urlObj = new URL(req.url, baseUrl);
  const urlParams = urlObj.searchParams;

  const code = urlParams.get('code');
  const state = urlParams.get('state');
  validateCallbackParams(code, state);

  await client.handleRedirect(code, state, context);

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

export const csrfMiddleware = (client: Client) => {
  return async (req: IRequest, res: IResponse, next: NextFunction) => {
    const mode = client.getConfig().session?.mode || SessionMode.SERVER;

    // Only enforce CSRF in server-side or hybrid modes
    if (mode === SessionMode.CLIENT) {
      return next();
    }

    // Skip for safe methods (GET, HEAD, OPTIONS)
    if (
      req.method === RequestMethod.GET ||
      req.method === RequestMethod.HEAD ||
      req.method === RequestMethod.OPTIONS
    ) {
      return next();
    }

    // --------------------------------------------
    // 1. Extract CSRF token from request headers
    // --------------------------------------------
    let csrfToken: string | undefined;

    // If req.headers is a native "Headers" instance
    if (req.headers instanceof Headers) {
      csrfToken = req.headers.get('x-csrf-token') || undefined;
    }
    // Otherwise, if it's a plain object
    else if (typeof req.headers === 'object' && req.headers !== null) {
      for (const key in req.headers as Record<string, any>) {
        if (key.toLowerCase() === 'x-csrf-token') {
          const val = req.headers[key];
          if (Array.isArray(val)) {
            // If somehow multiple token headers were sent, pick the last or the first
            csrfToken = (val as string[])[(val as string[]).length - 1];
          } else if (typeof val === 'string') {
            csrfToken = val;
          }
          break;
        }
      }
    }

    // --------------------------------------------
    // 2. Compare extracted token to stored token
    // --------------------------------------------
    const storedCsrfToken = req.session?.csrfToken;
    if (!csrfToken || csrfToken !== storedCsrfToken) {
      client
        .getLogger()
        .warn('Invalid CSRF token', { csrfToken, storedCsrfToken });
      // If your response object is fetch-like or Express-like,
      // this should still work. Otherwise, see your cookieUtils
      // approach (e.g. set status code, send text, etc.).
      res.status(403).send('Invalid CSRF token');
      return;
    }

    // If everything is good, move on
    return next();
  };
};

const patchExpressResponseForSetCookie = (res: any) => {
  if (typeof res.getHeader !== 'function') {
    res.getHeader = function (name: string) {
      const value = res.get(name);
      return Array.isArray(value) ? value : (value ?? undefined);
    };
  }

  if (typeof res.setHeader !== 'function') {
    res.setHeader = function (name: string, value: string | string[]) {
      if (Array.isArray(value)) {
        value.forEach((v) => res.append(name, v));
      } else {
        res.set(name, value);
      }
    };
  }
};
