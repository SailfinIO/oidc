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
} from '../interfaces';
import { parse } from '../utils';
import { ClientError } from '../errors';

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

    // Extract sid from cookies
    const sid = this.getSidFromCookies(context);

    if (sid) {
      // Attempt to resume existing session
      const sessionData = await this.sessionStore.get(sid, context);
      if (sessionData) {
        this.sid = sid;
        this.logger.debug('Existing session resumed', { sid });
        this.scheduleTokenRefresh(context);
        return;
      } else {
        this.logger.warn('SID found but no corresponding session data.');
      }
    }

    // No valid session found; create a new one
    await this.createNewSession(context);
  }

  /**
   * Retrieves the session ID from cookies.
   * @param context The store context containing the request.
   * @returns The session ID or null if not found.
   */
  private getSidFromCookies(context: IStoreContext): string | null {
    const cookieHeader = context.request.headers.get('cookie');
    if (cookieHeader && typeof cookieHeader === 'string') {
      const cookies = parse(cookieHeader);
      return cookies[this.config.session?.cookie?.name || 'sid'] || null;
    }
    return null;
  }

  /**
   * Creates a new session using tokens from the tokenClient.
   * @param context The store context containing the request and response.
   */
  private async createNewSession(context: IStoreContext): Promise<void> {
    const tokens = this.tokenClient.getTokens();
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

    // Store session data and receive `sid`
    const sid = await this.sessionStore.set(sessionData, context);
    this.sid = sid;
    this.logger.debug('New session created', { sid });

    // Schedule token refresh if enabled
    this.scheduleTokenRefresh(context);
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
}
