// src/utils/cookieUtils.ts

import { RequestHeaders, RequestCookies } from '../interfaces';
import { parse } from './Cookie';

/**
 * Parses the 'Cookie' header from the request and returns a parsed cookies object.
 *
 * @param {RequestHeaders} headers - The headers object from the request.
 * @returns {RequestCookies} The parsed cookies as a key-value object.
 */
export const parseCookies = (headers: RequestHeaders): RequestCookies => {
  let cookieHeader: string | undefined;

  // Check if headers has a get method (e.g., Headers instance)
  if (typeof headers.get === 'function') {
    cookieHeader = headers.get('cookie') || headers.get('COOKIE');
  }
  // Otherwise, treat headers as a plain object
  else if (typeof headers === 'object' && headers !== null) {
    cookieHeader = (headers as any)['cookie'] || (headers as any)['COOKIE'];
  }

  if (!cookieHeader) {
    return {}; // Return an empty object if no cookies are present
  }

  try {
    // Parse the cookie string into a key-value object
    return parse(cookieHeader) as RequestCookies;
  } catch (error) {
    console.error('Failed to parse cookies:', error);
    return {}; // Return an empty object if parsing fails
  }
};
