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
    sessionStore: ISessionStore, // Changed from IStore to ISessionStore
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

    // Extract sid from cookies using .get() method
    const cookieHeader = context.request.headers.get('cookie');
    let sid: string | null = null;

    if (cookieHeader && typeof cookieHeader === 'string') {
      const cookies = parse(cookieHeader);
      sid = cookies[this.config.session?.cookie?.name || 'sid'] || null;
    }

    if (sid) {
      // Retrieve existing session data using ISessionStore
      const sessionData = await this.sessionStore.get(sid, context);
      if (sessionData) {
        this.sid = sid;
        this.logger.debug('Existing session found', { sid });
        if (this.config.session?.useSilentRenew) {
          this.scheduleTokenRefresh(context);
        }
        return;
      }
    }

    // If no existing session, create a new one
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
      // Proceed with undefined user info
    }

    const newSessionData: ISessionData = {
      cookie: tokens,
      user: userInfo || undefined,
    };

    // Use ISessionStore to set session data and receive `sid`
    this.sid = await this.sessionStore.set(newSessionData, context);
    this.logger.debug('New session created', { sid: this.sid });

    if (this.config.session?.useSilentRenew) {
      this.scheduleTokenRefresh(context);
    }
  }

  /**
   * Schedules a token refresh based on token expiration.
   * @param context The store context containing the request and response.
   */
  private async scheduleTokenRefresh(context: IStoreContext): Promise<void> {
    try {
      const tokens = await this.tokenClient.getTokens();
      if (tokens?.expires_in) {
        const refreshTime =
          (tokens.expires_in - (this.config.tokenRefreshThreshold || 60)) *
          1000;
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
      this.stop(context); // Pass context to stop method
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
      // Proceed with undefined user info
    }

    const sessionData: ISessionData = {
      cookie: tokens,
      user: userInfo || undefined, // Optionally retain existing user info
    };

    // Use ISessionStore to touch (update) the session
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
      // Use ISessionStore to destroy the session
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
