import { CookieOptions } from './CookieOptions';

export interface StoreOptions {
  cookieName?: string;
  defaultTTL?: number;
  cookieOptions?: CookieOptions;
}
