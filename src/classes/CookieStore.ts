/**
 * @fileoverview
 * Implements the `CookieStore` class, which provides a server-side session store
 * utilizing cookies for session management. It allows setting, retrieving,
 * destroying, and updating sessions using a secure cookie mechanism.
 *
 * @module src/classes/CookieStore
 */

import {
  ISessionStore,
  ISessionData,
  IStoreContext,
  CookieOptions,
  ILogger,
} from '../interfaces';
import { randomUUID } from 'crypto';
import { Mutex, Logger } from '../utils';
import { SameSite } from '../enums';
import { IStore } from '../interfaces/IStore';
import { MemoryStore } from './MemoryStore';
import { Cookie } from '../utils/Cookie';

/**
 * Represents a server-side session store implemented using cookies.
 *
 * The `CookieStore` class provides a secure and flexible mechanism for
 * managing sessions through HTTP cookies, with support for concurrent access
 * control, session expiration, and session persistence using an internal data store.
 *
 * @class
 * @implements {ISessionStore}
 */
export class CookieStore implements ISessionStore {
  private readonly logger: ILogger;
  private readonly cookieName: string;
  private readonly cookieOptions: CookieOptions;
  private readonly mutex: Mutex;
  private readonly dataStore: IStore;

  /**
   * Creates an instance of `CookieStore`.
   *
   * @param {string} [cookieName='sid'] - The name of the session cookie.
   * @param {CookieOptions} [cookieOptions] - Options for the cookie attributes.
   * @param {IStore} [dataStore] - Optional internal data store for session persistence.
   * @throws {Error} Throws an error if the logger or data store initialization fails.
   */
  constructor(
    cookieName: string = 'sid',
    cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: SameSite.STRICT,
      path: '/',
      maxAge: 3600, // in seconds
    },
    dataStore?: IStore,
  ) {
    this.logger = new Logger(CookieStore.name);
    this.cookieName = cookieName;
    this.cookieOptions = cookieOptions;
    this.mutex = new Mutex();
    this.dataStore =
      dataStore || new MemoryStore(this.logger, cookieOptions.maxAge * 1000);
  }

  /**
   * Sets a session by storing session data and issuing a session cookie.
   *
   * @param {ISessionData} data - The session data to store.
   * @param {IStoreContext} [context] - The store context, including the HTTP response.
   * @returns {Promise<string>} Resolves with the session ID (SID) string.
   * @throws {Error} Throws an error if the response object is not provided.
   */
  public async set(
    data: ISessionData,
    context?: IStoreContext,
  ): Promise<string> {
    if (!context?.response) {
      throw new Error('Response object is required to set cookies.');
    }

    return this.mutex.runExclusive(async () => {
      const sid = randomUUID();
      await this.dataStore.set(sid, data, context);

      const cookie = new Cookie(this.cookieName, sid, {
        ...this.cookieOptions,
        maxAge: this.cookieOptions.maxAge,
      });

      const serializedCookie = cookie.serialize();
      context.response.headers.append('Set-Cookie', serializedCookie);
      this.logger.debug('Session set with SID', { sid });
      return sid;
    });
  }

  /**
   * Retrieves session data for the specified session ID (SID).
   *
   * @param {string} sid - The session ID.
   * @param {IStoreContext} [context] - The store context, including the HTTP request.
   * @returns {Promise<ISessionData | null>} Resolves with the session data or `null` if not found.
   * @throws {Error} Throws an error if the request object is not provided.
   */
  public async get(
    sid: string,
    context?: IStoreContext,
  ): Promise<ISessionData | null> {
    if (!context?.request) {
      throw new Error('Request object is required to get cookies.');
    }

    return this.mutex.runExclusive(async () => {
      const cookieHeader = context.request.headers.get('cookie');
      if (!cookieHeader || typeof cookieHeader !== 'string') {
        return null;
      }

      const cookieStrings = cookieHeader
        .split(';')
        .map((cookie) => cookie.trim());
      const sessionCookieString = cookieStrings.find((cookieStr) =>
        cookieStr.startsWith(`${this.cookieName}=`),
      );

      if (!sessionCookieString) {
        return null;
      }

      try {
        const sessionCookie = Cookie.parse(sessionCookieString);
        const sessionId = sessionCookie.value;

        if (sessionId !== sid) {
          return null;
        }

        const sessionData = await this.dataStore.get(sid, context);
        this.logger.debug('Session retrieved', { sid, sessionData });
        return sessionData;
      } catch (error) {
        this.logger.error('Error parsing session cookie', { error });
        return null;
      }
    });
  }

  /**
   * Destroys the session for the specified session ID (SID).
   *
   * @param {string} sid - The session ID to destroy.
   * @param {IStoreContext} [context] - The store context, including the HTTP response.
   * @returns {Promise<void>} Resolves when the session is destroyed.
   * @throws {Error} Throws an error if the response object is not provided.
   */
  public async destroy(sid: string, context?: IStoreContext): Promise<void> {
    if (!context?.response) {
      throw new Error('Response object is required to destroy cookies.');
    }

    return this.mutex.runExclusive(async () => {
      await this.dataStore.destroy(sid, context);

      const expiredCookie = new Cookie(this.cookieName, '', {
        ...this.cookieOptions,
        maxAge: 0,
      });

      const serializedCookie = expiredCookie.serialize();
      context.response.headers.append('Set-Cookie', serializedCookie);
      this.logger.debug('Session destroyed', { sid });
    });
  }

  /**
   * Updates the session and resets the cookie's expiration time.
   *
   * @param {string} sid - The session ID to touch.
   * @param {ISessionData} session - The updated session data.
   * @param {IStoreContext} [context] - The store context, including the HTTP response.
   * @returns {Promise<void>} Resolves when the session is updated.
   * @throws {Error} Throws an error if the response object is not provided.
   */
  public async touch(
    sid: string,
    session: ISessionData,
    context?: IStoreContext,
  ): Promise<void> {
    if (!context?.response) {
      throw new Error('Response object is required to touch cookies.');
    }

    return this.mutex.runExclusive(async () => {
      await this.dataStore.touch(sid, session, context);

      const touchedCookie = new Cookie(this.cookieName, sid, {
        ...this.cookieOptions,
        maxAge: this.cookieOptions.maxAge,
      });

      const serializedCookie = touchedCookie.serialize();
      context.response.headers.append('Set-Cookie', serializedCookie);
      this.logger.debug('Session touched', { sid });
    });
  }
}
