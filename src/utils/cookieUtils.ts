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
): boolean => {
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

/**
 * Patches a response object to behave more like an Express `res`,
 * ensuring it has getHeader(), setHeader(), get(), set(), and append().
 *
 * Internally, stores multiple header values in a Map<string, string[]>.
 * On .getHeader() / .get(), if there's only 1 value, returns that string;
 * if more than 1, returns an array of values.
 *
 * This is helpful in an environment where you don't have a genuine Express
 * response and want to run code that expects Express-like behavior.
 */
export const patchExpressResponseForSetCookie = (res: any): void => {
  // We'll store multiple header values under a lowercase key
  // (e.g. 'set-cookie' => ['session=123; HttpOnly', 'another=cookieValue']).
  // This is similar to what Express does internally.
  const headerStore = new Map<string, string[]>();

  // Helper: retrieve all values for a header (case-insensitive).
  const getHeaderValues = (headerName: string): string[] | undefined => {
    const lower = headerName.toLowerCase();
    return headerStore.get(lower);
  };

  // Helper: set a brand-new array of header values.
  const setHeaderValues = (headerName: string, values: string[]): void => {
    const lower = headerName.toLowerCase();
    headerStore.set(lower, values);
  };

  // Helper: append one additional header value
  const appendHeaderValue = (headerName: string, value: string): void => {
    const lower = headerName.toLowerCase();
    const existing = headerStore.get(lower) || [];
    existing.push(value);
    headerStore.set(lower, existing);
  };

  // (1) res.getHeader(name)
  if (typeof res.getHeader !== 'function') {
    res.getHeader = function (name: string): string | string[] | undefined {
      const values = getHeaderValues(name);
      if (!values) return undefined;
      if (values.length === 1) return values[0];
      return values;
    };
  }

  // (2) res.setHeader(name, value)
  if (typeof res.setHeader !== 'function') {
    res.setHeader = function (name: string, value: string | string[]): void {
      if (Array.isArray(value)) {
        // multiple header lines
        value.forEach((v) => appendHeaderValue(name, v));
      } else {
        // single header line
        setHeaderValues(name, [value]);
      }
    };
  }

  // (3) res.get(name) – Express alias for retrieving a header
  if (typeof res.get !== 'function') {
    res.get = function (name: string): string | string[] | undefined {
      // Reuse getHeader under the hood
      return res.getHeader(name);
    };
  }

  // (4) res.set(name, value) – Express alias for setting a header
  if (typeof res.set !== 'function') {
    res.set = function (name: string, value: string | string[]): any {
      // Reuse setHeader under the hood
      res.setHeader(name, value);
      return res; // Express usually returns `this`.
    };
  }

  // (5) res.append(name, value) – used for appending values (especially cookies)
  if (typeof res.append !== 'function') {
    res.append = function (name: string, value: string): any {
      appendHeaderValue(name, value);
      return res;
    };
  }
};
