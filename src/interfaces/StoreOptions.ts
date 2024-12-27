// src/interfaces/StoreOptions.ts

import { CookieOptions } from './CookieOptions';

import { ISessionStore } from './ISessionStore';

export interface StoreOptions {
  storage?: {
    ttl?: number;
  };
  session?: {
    cookie?: {
      name?: string;
      options?: CookieOptions;
    };
    store?: ISessionStore;
  };
}
