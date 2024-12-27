import { CookieOptions } from './CookieOptions';
import { IStore } from './IStore';

export interface StoreOptions {
  storage?: {
    ttl?: number;
  };
  session?: {
    cookie?: {
      name?: string;
      options?: CookieOptions;
    };
    store?: IStore; // Custom IStore for internal data storage in CookieStore
  };
}
