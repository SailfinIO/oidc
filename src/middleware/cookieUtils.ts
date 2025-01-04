// src/middleware/cookieUtils.ts

import { ParsedCookies, parse } from '../utils/Cookie';

/**
 * Parses the 'Cookie' header from the request and returns a ParsedCookies object.
 *
 * @param {Headers} headers - The Headers object from the Request.
 * @returns {ParsedCookies} The parsed cookies.
 */
export const parseCookies = (headers: globalThis.Headers): ParsedCookies => {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return {};

  try {
    return parse(cookieHeader);
  } catch (error) {
    console.error('Failed to parse cookies:', error);
    return {};
  }
};
