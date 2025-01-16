// src/classes/Session.ts

import {
  IClientConfig,
  ILogger,
  IToken,
  IUserInfo,
  ISession,
  ISessionStore,
  IStoreContext,
  ISessionData,
  IUser,
  TokenSet,
  CookieOptions,
} from '../interfaces';
import { ClientError } from '../errors';
import { parseCookies } from '../utils';
import { SameSite, SessionMode, StorageMechanism } from '../enums';
import { randomBytes } from 'crypto';

export class Session implements ISession {
  private readonly config: IClientConfig;
  private readonly logger: ILogger;
  private readonly tokenClient: IToken;
  private readonly userInfoClient: IUserInfo;
  private readonly sessionStore: ISessionStore;
  private sessionTimer: NodeJS.Timeout | null = null;
  private _sid: string | null = null;

  constructor(
    config: IClientConfig,
    logger: ILogger,
    tokenClient: IToken,
    userInfoClient: IUserInfo,
    sessionStore: ISessionStore,
  ) {
    this.config = config;
    this.logger = logger;
    this.tokenClient = tokenClient;
    this.userInfoClient = userInfoClient;
    this.sessionStore = sessionStore;
  }

  /**
   * Starts a session by either resuming an existing one or creating a new one.
   * @param context The store context containing the request and response.
   */
  public async start(context: IStoreContext): Promise<void> {
    if (!context.request || !context.response) {
      throw new Error(
        'Both Request and Response objects are required to start a session.',
      );
    }

    const mode = this.config.session?.mode || SessionMode.SERVER;

    // Only do server side if mode is SERVER or HYBRID
    if (mode === SessionMode.SERVER || mode === SessionMode.HYBRID) {
      await this.handleServerSideSession(context);
    }

    // Only do client side if mode is CLIENT or HYBRID
    if (mode === SessionMode.CLIENT || mode === SessionMode.HYBRID) {
      await this.handleClientSideSession(context);
    }
  }

  private async handleClientSideSession(context: IStoreContext): Promise<void> {
    const tokens = this.tokenClient.getTokens();
    if (!tokens) {
      this.logger.warn('No tokens available for client-side session.');
      return;
    }

    // Use config to decide how to store the tokens
    if (this.config.session?.clientStorage === StorageMechanism.COOKIE) {
      try {
        this.exposeTokensToClient(context, tokens);
      } catch (err) {
        this.logger.error('Failed to expose tokens to client', err);
      }
    } else if (this.config.session?.clientStorage === StorageMechanism.LOCAL) {
      // Typically you'd provide an API response, not just a Set-Cookie
      context.response.json({ tokens });
      this.logger.debug('Sent tokens as JSON for local storage on the client');
    } else {
      this.logger.warn('Client-side session storage not configured.');
    }

    // Optionally fetch user info and store it in request.session
    try {
      const userInfo = await this.userInfoClient.getUserInfo();

      const currentSession = context.request.session || {}; // Get the current session or default to an empty object
      context.request.setSession({
        ...currentSession,
        user: userInfo,
      });

      this.logger.debug('User info fetched for client-side session');
    } catch (error) {
      this.logger.warn('Failed to fetch user info for client-side session', {
        error,
      });
    }

    this.scheduleTokenRefresh(context);
  }

  private async handleServerSideSession(context: IStoreContext): Promise<void> {
    if (!this.sessionStore) {
      this.logger.warn('Server-side session store not configured.');
      return;
    }

    const sid = this.getSidFromCookies(context);

    if (sid) {
      // Attempt to resume existing session
      const sessionData = await this.sessionStore.get(sid, context);
      if (sessionData) {
        this.sid = sid;
        context.request.setSession(sessionData);
        this.logger.debug('Server-side session resumed', { sid });
        this.scheduleTokenRefresh(context);
        return;
      } else {
        this.logger.warn('Invalid SID, clearing session', { sid });
        // Optionally, clear the invalid SID cookie
        this.clearSessionCookie(context);
      }
    }

    // No valid session found; create a new one
    const tokens = this.tokenClient.getTokens();
    if (!tokens) {
      throw new ClientError(
        'No tokens available to create a session.',
        'NO_TOKENS',
      );
    }
    await this.createNewServerSession(context, tokens);
  }

  private exposeTokensToClient(context: IStoreContext, tokens: TokenSet): void {
    if (!context.response) {
      this.logger.warn('No response object, skipping exposeTokensToClient');
      return;
    }

    // We wrap setCookieHeader calls in try/catch to detect if setting the cookie fails
    const setCookieSafe = (
      cookieName: string,
      cookieVal: string,
      options: CookieOptions,
    ): void => {
      try {
        context.response?.cookie(cookieName, cookieVal, options);
        this.logger.debug(`Cookie set successfully`, { cookieName, options });
      } catch (error) {
        this.logger.error(
          `Failed to set ${cookieName} cookie. Error: ${error.message}`,
          error,
        );
      }
    };

    setCookieSafe('access_token', tokens.access_token, {
      httpOnly: this.config.session?.cookie?.options?.httpOnly ?? true,
      secure: this.config.session?.cookie?.options?.secure ?? true,
      sameSite:
        this.config.session?.cookie?.options?.sameSite ?? SameSite.STRICT,
      path: this.config.session?.cookie?.options?.path ?? '/',
      maxAge: tokens.expires_in || 3600,
    });

    if (tokens.id_token) {
      setCookieSafe('id_token', tokens.id_token, {
        httpOnly: this.config.session?.cookie?.options?.httpOnly ?? true,
        secure: this.config.session?.cookie?.options?.secure ?? true,
        sameSite:
          this.config.session?.cookie?.options?.sameSite ?? SameSite.STRICT,
        path: this.config.session?.cookie?.options?.path ?? '/',
        maxAge: tokens.expires_in || 3600,
      });
    }

    if (tokens.refresh_token) {
      setCookieSafe('refresh_token', tokens.refresh_token, {
        httpOnly: this.config.session?.cookie?.options?.httpOnly ?? true,
        secure: this.config.session?.cookie?.options?.secure ?? true,
        sameSite:
          this.config.session?.cookie?.options?.sameSite ?? SameSite.STRICT,
        path: this.config.session?.cookie?.options?.path ?? '/',
        maxAge: 86400, // e.g. 1 day
      });
    }
  }

  private clearSessionCookie(context: IStoreContext): void {
    const sessionCookieName = this.config.session?.cookie?.name || 'sid';

    try {
      context.response?.clearCookie(sessionCookieName, {
        httpOnly: this.config.session?.cookie?.options?.httpOnly ?? true,
        secure: this.config.session?.cookie?.options?.secure ?? true,
        sameSite:
          this.config.session?.cookie?.options?.sameSite ?? SameSite.STRICT,
        path: this.config.session?.cookie?.options?.path ?? '/',
      });
      this.logger.debug(`Cleared session cookie: ${sessionCookieName}`);
    } catch (error) {
      this.logger.error(
        `Failed to clear session cookie ${sessionCookieName}. Error: ${error.message}`,
        error,
      );
    }
  }

  private async createNewServerSession(
    context: IStoreContext,
    tokens: TokenSet,
  ): Promise<void> {
    if (!tokens) {
      throw new ClientError(
        'No tokens available to create a session.',
        'NO_TOKENS',
      );
    }

    let userInfo: IUser | null = null;
    try {
      userInfo = await this.userInfoClient.getUserInfo();
      this.logger.debug('User info fetched during new server session creation');
    } catch (error) {
      this.logger.warn('Failed to fetch user info during session creation', {
        error,
      });
    }

    const sessionData: ISessionData = {
      cookie: tokens,
      user: userInfo || undefined,
    };

    // Try/catch around store.set
    let sid: string;
    try {
      sid = await this.sessionStore.set(sessionData, context);
      if (!sid) {
        this.logger.error('Session store returned a null/undefined SID.');
        throw new ClientError(
          'Session store did not return a valid session ID',
          'SESSION_ERROR',
        );
      }
    } catch (err) {
      this.logger.error('Failed to store session data', err);
      throw new ClientError(
        'Could not create new server session',
        'SESSION_ERROR',
        {
          originalError: err,
        },
      );
    }

    this.sid = sid;
    context.request.setSession(sessionData);
    this.logger.debug('New server-side session created', { sid });

    const sessionCookieName = this.config.session?.cookie?.name || 'sid';

    // Safely set the session cookie
    try {
      context.response?.cookie(sessionCookieName, sid, {
        httpOnly: this.config.session?.cookie?.options?.httpOnly ?? true,
        secure: this.config.session?.cookie?.options?.secure ?? true,
        sameSite:
          this.config.session?.cookie?.options?.sameSite ?? SameSite.STRICT,
        path: this.config.session?.cookie?.options?.path ?? '/',
        maxAge: this.config.session?.ttl
          ? this.config.session.ttl / 1000
          : 3600, // Default 1 hour
      });
      this.logger.debug(
        `Session cookie "${sessionCookieName}" set successfully.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to set server-side session cookie "${sessionCookieName}".`,
        error,
      );
    }

    // Generate CSRF token
    const csrfToken = randomBytes(32).toString('hex');
    context.request.session.csrfToken = csrfToken;

    // Set CSRF token in a separate cookie
    try {
      context.response?.cookie('csrf_token', csrfToken, {
        httpOnly: this.config.session?.cookie?.options?.httpOnly ?? true,
        secure: this.config.session?.cookie?.options?.secure ?? true,
        sameSite:
          this.config.session?.cookie?.options?.sameSite ?? SameSite.STRICT,
        path: this.config.session?.cookie?.options?.path ?? '/',
        maxAge: 3600, // 1 hour
      });
      this.logger.debug(`CSRF cookie set successfully.`);
    } catch (error) {
      this.logger.warn('Failed to set CSRF cookie.', error);
    }

    // Schedule token refresh
    this.scheduleTokenRefresh(context);
  }

  /**
   * Retrieves the session ID from cookies.
   * @param context The store context containing the request.
   * @returns The session ID or null if not found.
   */
  private getSidFromCookies(context: IStoreContext): string | null {
    const cookies = parseCookies(context.request.headers);
    const sessionCookieName = this.config.session?.cookie?.name || 'sid';
    const sid = cookies[sessionCookieName] || null;
    if (!sid) {
      this.logger.debug(`No SID found in cookies under "${sessionCookieName}"`);
    }
    return sid;
  }

  /**
   * Schedules a token refresh based on token expiration.
   * @param context The store context containing the request and response.
   */
  private async scheduleTokenRefresh(context: IStoreContext): Promise<void> {
    try {
      const tokens = await this.tokenClient.getTokens();
      if (tokens?.expires_in) {
        const refreshThreshold =
          (this.config.tokenRefreshThreshold || 60) * 1000; // default 60 seconds
        const refreshTime = tokens.expires_in * 1000 - refreshThreshold;

        // Clear any existing timer
        if (this.sessionTimer) {
          clearTimeout(this.sessionTimer);
        }

        this.sessionTimer = setTimeout(() => {
          this.refreshToken(context);
        }, refreshTime);

        this.logger.debug('Scheduled token refresh in', { refreshTime });
      } else {
        this.logger.debug(
          'No expires_in found on tokens, skipping scheduled refresh.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to schedule token refresh', { error });
    }
  }

  /**
   * Refreshes the access token and updates the session.
   * @param context The store context containing the request and response.
   */
  private async refreshToken(context: IStoreContext): Promise<void> {
    try {
      await this.tokenClient.refreshAccessToken();
      await this.updateSession(context);
      this.scheduleTokenRefresh(context);
      this.logger.info('Access token refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh access token', { error });
      await this.stop(context);
    }
  }

  /**
   * Updates the session data with refreshed tokens and user info.
   * @param context The store context containing the request and response.
   */
  private async updateSession(context: IStoreContext): Promise<void> {
    if (!this.sid) {
      this.logger.warn(
        'No SID found for session update. Session may not be started.',
      );
      return;
    }

    const tokens = await this.tokenClient.getTokens();
    if (!tokens) {
      this.logger.warn('No tokens available to update the session.');
      return;
    }

    let userInfo: IUser | null = null;
    try {
      userInfo = await this.userInfoClient.getUserInfo();
    } catch (error) {
      this.logger.warn('Failed to fetch user info during session update', {
        error,
      });
    }

    const sessionData: ISessionData = {
      cookie: tokens,
      user: userInfo || undefined,
    };

    try {
      await this.sessionStore.touch(this.sid, sessionData, context);
      this.logger.debug('Session data updated', { sid: this.sid });
    } catch (err) {
      this.logger.error('Failed to update session data in session store', err);
    }
  }

  /**
   * Stops the session by clearing timers and destroying session data.
   * @param context The store context containing the request and response.
   */
  public async stop(context: IStoreContext): Promise<void> {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
      this.logger.debug('Session timer cleared');
    }
    if (this.sid) {
      try {
        await this.sessionStore.destroy(this.sid, context);
        this.logger.debug('Session destroyed', { sid: this.sid });
        this.sid = null;
      } catch (err) {
        this.logger.error('Failed to destroy session', err);
      }
    }
  }

  /**
   * Getter for the session ID.
   */
  public get sid(): string | null {
    return this._sid;
  }

  /**
   * Setter for the session ID.
   * @param value The new session ID value.
   */
  private set sid(value: string | null) {
    if (value && typeof value !== 'string') {
      throw new Error('Session ID must be a string or null.');
    }
    this.logger.debug('Setting session ID', { sid: value });
    this._sid = value;
  }

  public async update(context: IStoreContext): Promise<void> {
    // 1) Get the newly refreshed tokens from the tokenClient
    const tokens = this.tokenClient.getTokens();
    if (!tokens) {
      this.logger.warn('No tokens available after refresh');
      return;
    }

    // 2) Expose them to the client (if in client or hybrid mode)
    if (
      this.config.session?.mode === SessionMode.CLIENT ||
      this.config.session?.mode === SessionMode.HYBRID
    ) {
      this.logger.debug('Exposing refreshed tokens to client');
      try {
        this.exposeTokensToClient(context, tokens);
      } catch (err) {
        this.logger.error('Failed to expose refreshed tokens to client', err);
      }
    }

    // 3) Update server-side if in server or hybrid mode
    if (
      this.config.session?.mode === SessionMode.SERVER ||
      this.config.session?.mode === SessionMode.HYBRID
    ) {
      try {
        await this.save(context, tokens);
      } catch (err) {
        this.logger.error('Failed to save refreshed tokens server-side', err);
      }
    }
  }

  public async save(context: IStoreContext, tokens: TokenSet): Promise<void> {
    // 1) Check if we have an existing session ID (sid) from cookies
    const sessionCookieName = this.config.session?.cookie?.name || 'sid';
    const sid = context.request.cookies[sessionCookieName];

    if (!sid) {
      this.logger.debug('No existing SID found; creating a new server session');
      await this.createNewServerSession(context, tokens);
      return;
    }

    // 2) Attempt to retrieve the existing session from the session store
    let sessionData = await this.sessionStore.get(sid, context);
    if (!sessionData) {
      this.logger.warn(
        `Session store had no session for sid=${sid}; creating a new session.`,
      );
      await this.createNewServerSession(context, tokens);
      return;
    }

    // 3) Update the existing session with the new tokens
    sessionData.cookie = tokens;

    // 4) Optionally fetch user info
    try {
      const userInfo = await this.userInfoClient.getUserInfo();
      sessionData.user = userInfo;
    } catch (err) {
      this.logger.warn('Failed to fetch user info after refresh', err);
    }

    // 5) Finally, store the updated session data back into the session store
    try {
      await this.sessionStore.touch(sid, sessionData, context);
      this.logger.debug('Server-side session updated with new tokens', { sid });
    } catch (err) {
      this.logger.error('Failed to update existing session store entry', err);
    }
  }
}
