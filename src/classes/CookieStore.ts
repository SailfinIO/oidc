// src/classes/CookieStore.ts

import {
  IStore,
  ISessionData,
  IStoreContext,
  CookieOptions,
} from '../interfaces';
import { randomUUID } from 'crypto';
import { Mutex, serialize, parse } from '../utils';
import { SameSite } from '../enums';
import { MemoryStore } from './MemoryStore';

export class CookieStore implements IStore {
  private readonly cookieName: string;
  private readonly cookieOptions: CookieOptions;
  private readonly mutex: Mutex;
  private readonly dataStore: IStore; // Server-side store for session data

  constructor(
    cookieName: string = 'sid',
    cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: SameSite.STRICT,
      path: '/',
      maxAge: 3600, // in seconds
    },
    dataStore?: IStore, // Inject a server-side store
  ) {
    this.cookieName = cookieName;
    this.cookieOptions = cookieOptions;
    this.mutex = new Mutex();
    this.dataStore =
      dataStore || new MemoryStore(undefined, cookieOptions.maxAge * 1000);
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
      // Store session data in the server-side store
      await this.dataStore.set(data);
      // Set the session ID in the cookie
      const serializedCookie = serialize(this.cookieName, sid, {
        ...this.cookieOptions,
        maxAge: this.cookieOptions.maxAge, // Ensure maxAge is in seconds
      });
      context.response.headers.append('Set-Cookie', serializedCookie);
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
      const cookieHeader = context.request.headers['cookie'];
      if (!cookieHeader || typeof cookieHeader !== 'string') {
        return null;
      }

      const cookies = parse(cookieHeader);
      const sessionId = cookies[this.cookieName];

      if (!sessionId || sessionId !== sid) {
        return null;
      }

      // Retrieve session data from the server-side store
      const sessionData = await this.dataStore.get(sid);
      return sessionData;
    });
  }

  public async destroy(sid: string, context?: IStoreContext): Promise<void> {
    if (!context?.response) {
      throw new Error('Response object is required to destroy cookies.');
    }

    return this.mutex.runExclusive(async () => {
      // Destroy session data from the server-side store
      await this.dataStore.destroy(sid);
      // Expire the cookie
      const serializedCookie = serialize(this.cookieName, '', {
        ...this.cookieOptions,
        maxAge: 0, // Expire the cookie
      });
      context.response.headers.append('Set-Cookie', serializedCookie);
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
      // Update session data in the server-side store
      await this.dataStore.touch(sid, session);
      // Reset the cookie's maxAge
      const serializedCookie = serialize(this.cookieName, sid, {
        ...this.cookieOptions,
        maxAge: this.cookieOptions.maxAge, // Reset maxAge
      });
      context.response.headers.append('Set-Cookie', serializedCookie);
    });
  }
}
