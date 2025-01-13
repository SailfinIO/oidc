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
} from '../interfaces';
import { ClientError } from '../errors';
import { Cookie, parseCookies } from '../utils';
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
      this.exposeTokensToClient(context, tokens);
    } else if (this.config.session?.clientStorage === StorageMechanism.LOCAL) {
      // Typically you'd provide an API response, not just a Set-Cookie
      context.response.json({ tokens });
      // Then the JS client can do localStorage.setItem('access_token', tokens.access_token);
    } else {
      this.logger.warn('Client-side session storage not configured.');
    }

    // Optionally fetch user info and put it into request.session (server memory only)
    try {
      const userInfo = await this.userInfoClient.getUserInfo();
      context.request.session = {
        ...context.request.session,
        user: userInfo,
      };
    } catch (error) {
      this.logger.warn('Failed to fetch user info for client-side session', {
        error,
      });
    }

    this.scheduleTokenRefresh(context);
  }

  private async handleServerSideSession(context: IStoreContext): Promise<void> {
    const sessionStore = this.sessionStore;
    if (!sessionStore) {
      this.logger.warn('Server-side session store not configured.');
      return;
    }

    const sid = this.getSidFromCookies(context);

    if (sid) {
      // Attempt to resume existing session
      const sessionData = await sessionStore.get(sid, context);
      if (sessionData) {
        this.sid = sid;
        context.request.session = sessionData;
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
    const { response } = context;

    if (!response) {
      this.logger.error(
        'Response object is required to set client-side tokens.',
      );
      return;
    }

    // Define token cookies
    const accessTokenCookie = new Cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: SameSite.STRICT,
      path: '/',
      maxAge: tokens.expires_in || 3600, // Default to 1 hour if not specified
    });

    const idTokenCookie = tokens.id_token
      ? new Cookie('id_token', tokens.id_token, {
          httpOnly: true,
          secure: true,
          sameSite: SameSite.STRICT,
          path: '/',
          maxAge: tokens.expires_in || 3600,
        })
      : null;

    const refreshTokenCookie = tokens.refresh_token
      ? new Cookie('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: SameSite.STRICT,
          path: '/',
          maxAge: 86400, // Example: 1 day
        })
      : null;

    // Append tokens to response cookies
    response.headers.append('Set-Cookie', accessTokenCookie.serialize());
    if (idTokenCookie) {
      response.headers.append('Set-Cookie', idTokenCookie.serialize());
    }
    if (refreshTokenCookie) {
      response.headers.append('Set-Cookie', refreshTokenCookie.serialize());
    }
  }

  private clearSessionCookie(context: IStoreContext): void {
    const sessionCookieName = this.config.session?.cookie?.name || 'sid';
    const expiredCookie = new Cookie(sessionCookieName, '', {
      httpOnly: true,
      secure: true,
      sameSite: SameSite.STRICT,
      path: '/',
      expires: new Date(0),
    });

    context.response.headers.append('Set-Cookie', expiredCookie.serialize());
  }

  private async createNewServerSession(
    context: IStoreContext,
    tokens?: TokenSet,
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
    } catch (error) {
      this.logger.warn('Failed to fetch user info during session creation', {
        error,
      });
      // Proceed without user info
    }

    const sessionData: ISessionData = {
      cookie: tokens,
      user: userInfo || undefined,
    };

    const sid = await this.sessionStore!.set(sessionData, context);
    this.sid = sid;
    context.request.session = sessionData;
    this.logger.debug('New server-side session created', { sid });

    const sessionCookieName = this.config.session?.cookie?.name || 'sid';

    // Set SID in a secure cookie
    const sessionCookie = new Cookie(sessionCookieName, sid, {
      httpOnly: true,
      secure: true,
      sameSite: SameSite.STRICT,
      path: '/',
      maxAge: this.config.session?.ttl ? this.config.session.ttl / 1000 : 3600, // Default 1 hour
    });

    context.response.headers.append('Set-Cookie', sessionCookie.serialize());

    // Generate CSRF token
    const csrfToken = randomBytes(32).toString('hex');
    context.request.session.csrfToken = csrfToken;

    // Set CSRF token in a separate cookie
    const csrfCookie = new Cookie('csrf_token', csrfToken, {
      httpOnly: true,
      secure: true,
      sameSite: SameSite.STRICT,
      path: '/',
      maxAge: 3600, // 1 hour
    });

    context.response.headers.append('Set-Cookie', csrfCookie.serialize());

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
    return cookies[this.config.session?.cookie?.name || 'sid'] || null;
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
    if (!this.sid) return;

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
      // Proceed without user info
    }

    const sessionData: ISessionData = {
      cookie: tokens,
      user: userInfo || undefined, // Optionally retain existing user info
    };

    // Update (touch) the session data
    await this.sessionStore.touch(this.sid, sessionData, context);
    this.logger.debug('Session data updated', { sid: this.sid });
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
      await this.sessionStore.destroy(this.sid, context);
      this.logger.debug('Session destroyed', { sid: this.sid });
      this.sid = null;
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
    //    e.g., set cookies if session.mode === 'client' || 'hybrid'
    if (
      this.config.session?.mode === SessionMode.CLIENT ||
      this.config.session?.mode === SessionMode.HYBRID
    ) {
      this.exposeTokensToClient(context, tokens);
    }

    // 3) (Optional) If you also store them server-side, update the in-memory store
    // or session store with these new tokens. For example:
    if (
      this.config.session?.mode === SessionMode.SERVER ||
      this.config.session?.mode === SessionMode.HYBRID
    ) {
      // Re-save session data
      await this.save(context, tokens);
    }
  }

  public async save(context: IStoreContext, tokens: TokenSet): Promise<void> {
    // 1) Check if we have an existing session ID (sid) from cookies
    const sessionCookieName = this.config.session?.cookie?.name || 'sid';
    const sid = context.request.cookies[sessionCookieName];

    if (!sid) {
      // No sid cookie? Then create a new server session altogether.
      await this.createNewServerSession(context, tokens);
      return;
    }

    // 2) Attempt to retrieve the existing session from the session store
    let sessionData = await this.sessionStore.get(sid, context);
    if (!sessionData) {
      // If no sessionData found for this sid, treat it like a "new" session
      await this.createNewServerSession(context, tokens);
      return;
    }

    // 3) Update the existing session with the new tokens
    //    (In your code, 'cookie' is where you store actual token sets, but name it however you prefer)
    sessionData.cookie = tokens;

    // 4) (Optional) Fetch user info or do extra logic if you want user details in session
    try {
      const userInfo = await this.userInfoClient.getUserInfo();
      sessionData.user = userInfo;
    } catch (err) {
      this.logger.warn('Failed to fetch user info after refresh', err);
    }

    // 5) Finally, store the updated session data back into the session store
    await this.sessionStore.touch(sid, sessionData, context);
    this.logger.debug('Server-side session updated with new tokens', { sid });
  }
}
