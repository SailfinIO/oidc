// src/middleware/cookieUtils.ts

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
