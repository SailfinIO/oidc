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
 */
export const setCookieHeader = (
  response: IResponse | undefined,
  cookieString: string,
) => {
  if (!response) return;

  // Case A: Express-style
  // If your custom IResponse has `setHeader()` or `header()`, you can detect that:
  if (typeof (response as any).setHeader === 'function') {
    // Convert to array if you already have existing cookies
    // In Express, if multiple cookies are needed, you'd do:
    //   const existing = (response as any).getHeader('Set-Cookie') || [];
    //   const allCookies = Array.isArray(existing) ? existing : [existing];
    //   allCookies.push(cookieString);
    //   (response as any).setHeader('Set-Cookie', allCookies);

    (response as any).setHeader('Set-Cookie', cookieString);
    return;
  }

  // Case B: Fetch-like
  // If you have a Response object with `response.headers.append(...)`
  if (response.headers && typeof response.headers.append === 'function') {
    response.headers.append('Set-Cookie', cookieString);
    return;
  }

  // Otherwise, do nothing or log
  console.warn(
    'Unable to set cookie. The response object is not recognized as Express or Fetch-like.',
  );
};
