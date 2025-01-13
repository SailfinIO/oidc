// src/middleware/cookieUtils.ts

import { IResponse } from '../interfaces';
import { ParsedCookies, parse } from './Cookie';

/**
 * Parses the 'Cookie' header from the request and returns a ParsedCookies object.
 *
 * @param {Headers | Record<string, string | string[]>} headers - The Headers object or a plain object containing headers.
 * @returns {ParsedCookies} The parsed cookies.
 */
export const parseCookies = (
  headers: Headers | Record<string, string | string[]>,
): ParsedCookies => {
  let cookieHeader: string | undefined;

  if (headers instanceof Headers) {
    // If headers is an instance of Headers, use the .get() method
    cookieHeader = headers.get('cookie');
  } else if (typeof headers === 'object' && headers !== null) {
    // If headers is a plain object, perform a case-insensitive search
    for (const key in headers) {
      if (key.toLowerCase() === 'cookie') {
        const value = headers[key];
        // Handle multiple cookie headers (if any)
        if (Array.isArray(value)) {
          cookieHeader = value.join('; ');
        } else {
          cookieHeader = value;
        }
        break;
      }
    }
  }

  if (!cookieHeader) return {};

  try {
    return parse(cookieHeader);
  } catch (error) {
    console.error('Failed to parse cookies:', error);
    return {};
  }
};

/**
 * Attempts to set or append a cookie header based on the response type.
 * If multiple cookies already exist, this appends the new cookie(s) to them.
 *
 * @param response The IResponse (Express-like or fetch-like) or undefined.
 * @param cookieString A single Set-Cookie header string (e.g. "myCookie=value; Path=/; HttpOnly").
 */
export const setCookieHeader = (
  response: IResponse | undefined,
  cookieString: string,
) => {
  if (!response) return;

  // ─────────────────────────────────────────────────────────────────────────────
  // Case A: Express-style
  //   - If your custom IResponse is actually an Express Response,
  //     it might have getHeader() / setHeader().
  // ─────────────────────────────────────────────────────────────────────────────
  if (
    typeof (response as any).getHeader === 'function' &&
    typeof (response as any).setHeader === 'function'
  ) {
    const expressRes = response as any; // cast to "any" so we can call getHeader() etc.

    // 1) Grab any existing 'Set-Cookie' header(s)
    const currentSetCookie = expressRes.getHeader('Set-Cookie');

    /**
     * currentSetCookie can be:
     *   - undefined (no Set-Cookie yet)
     *   - string (one single Set-Cookie)
     *   - string[] (multiple Set-Cookie lines)
     */
    let allCookies: string[] = [];

    if (Array.isArray(currentSetCookie)) {
      // Already multiple cookies
      allCookies = [...currentSetCookie];
    } else if (typeof currentSetCookie === 'string') {
      // Just one existing cookie
      allCookies = [currentSetCookie];
    } else if (currentSetCookie != null) {
      // Something else (rare). We'll just coerce it:
      allCookies = [String(currentSetCookie)];
    }

    // 2) Append our new cookie
    allCookies.push(cookieString);

    // 3) Re-set all cookies
    expressRes.setHeader('Set-Cookie', allCookies);

    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Case B: Fetch-like
  //   - If you have a Response object with response.headers.append()
  //   - Each .append() call adds a new "Set-Cookie" header line.
  // ─────────────────────────────────────────────────────────────────────────────
  if (response.headers && typeof response.headers.append === 'function') {
    // Fetch-like APIs natively support multiple Set-Cookie headers by
    // calling .append('Set-Cookie', cookieString) multiple times.
    response.headers.append('Set-Cookie', cookieString);
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Otherwise, log a warning
  // ─────────────────────────────────────────────────────────────────────────────
  console.warn(
    'Unable to set cookie. The response object is not recognized as Express or fetch-like.',
  );
};
