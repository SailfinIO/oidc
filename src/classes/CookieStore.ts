// src/classes/CookieStore.ts

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

export class CookieStore implements ISessionStore {
  private readonly logger: ILogger;
  private readonly cookieName: string;
  private readonly cookieOptions: CookieOptions;
  private readonly mutex: Mutex;
  private readonly dataStore: IStore; // Internal data store

  constructor(
    cookieName: string = 'sid',
    cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: SameSite.STRICT,
      path: '/',
      maxAge: 3600, // in seconds
    },
    dataStore?: IStore, // Inject a server-side store, defaults to MemoryStore
  ) {
    this.logger = new Logger(CookieStore.name);
    this.cookieName = cookieName;
    this.cookieOptions = cookieOptions;
    this.mutex = new Mutex();
    this.dataStore =
      dataStore || new MemoryStore(this.logger, cookieOptions.maxAge * 1000);
  }

  public async set(
    data: ISessionData,
    context?: IStoreContext,
  ): Promise<string> {
    if (!context?.response) {
      throw new Error('Response object is required to set cookies.');
    }

    return this.mutex.runExclusive(async () => {
      const sid = randomUUID();
      // Store session data in the internal data store with sid as key
      await this.dataStore.set(sid, data, context);

      // Create a Cookie instance
      const cookie = new Cookie(this.cookieName, sid, {
        ...this.cookieOptions,
        maxAge: this.cookieOptions.maxAge, // Ensure maxAge is in seconds
      });

      // Serialize the cookie
      const serializedCookie = cookie.serialize();

      // Set the session ID in the cookie
      context.response.headers.append('Set-Cookie', serializedCookie);
      this.logger.debug('Session set with SID', { sid });
      return sid;
    });
  }

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

      // Split the cookie header into individual cookies
      const cookieStrings = cookieHeader
        .split(';')
        .map((cookie) => cookie.trim());

      // Find the cookie with the session ID
      const sessionCookieString = cookieStrings.find((cookieStr) =>
        cookieStr.startsWith(`${this.cookieName}=`),
      );

      if (!sessionCookieString) {
        return null;
      }

      try {
        // Parse the session cookie using the Cookie class
        const sessionCookie = Cookie.parse(sessionCookieString);

        const sessionId = sessionCookie.value;

        if (sessionId !== sid) {
          return null;
        }

        // Retrieve session data from the internal data store
        const sessionData = await this.dataStore.get(sid, context);
        this.logger.debug('Session retrieved', { sid, sessionData });
        return sessionData;
      } catch (error) {
        this.logger.error('Error parsing session cookie', { error });
        return null;
      }
    });
  }

  public async destroy(sid: string, context?: IStoreContext): Promise<void> {
    if (!context?.response) {
      throw new Error('Response object is required to destroy cookies.');
    }

    return this.mutex.runExclusive(async () => {
      // Destroy session data from the internal data store
      await this.dataStore.destroy(sid, context);

      // Create a Cookie instance with maxAge=0 to expire the cookie
      const expiredCookie = new Cookie(this.cookieName, '', {
        ...this.cookieOptions,
        maxAge: 0, // Expire the cookie
      });

      // Serialize the expired cookie
      const serializedCookie = expiredCookie.serialize();

      // Expire the cookie
      context.response.headers.append('Set-Cookie', serializedCookie);
      this.logger.debug('Session destroyed', { sid });
    });
  }

  public async touch(
    sid: string,
    session: ISessionData,
    context?: IStoreContext,
  ): Promise<void> {
    if (!context?.response) {
      throw new Error('Response object is required to touch cookies.');
    }

    return this.mutex.runExclusive(async () => {
      // Update session data in the internal data store
      await this.dataStore.touch(sid, session, context);

      // Create a new Cookie instance to reset the maxAge
      const touchedCookie = new Cookie(this.cookieName, sid, {
        ...this.cookieOptions,
        maxAge: this.cookieOptions.maxAge, // Reset maxAge
      });

      // Serialize the touched cookie
      const serializedCookie = touchedCookie.serialize();

      // Reset the cookie's maxAge
      context.response.headers.append('Set-Cookie', serializedCookie);
      this.logger.debug('Session touched', { sid });
    });
  }
}
