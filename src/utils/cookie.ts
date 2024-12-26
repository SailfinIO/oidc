import { Priority, SameSite } from '../enums';
import {
  COOKIE_NAME_REG_EXP,
  COOKIE_VALUE_REG_EXP,
  DOMAIN_VALUE_REG_EXP,
  PATH_VALUE_REG_EXP,
} from '../constants/cookie-constants';
import { ParseOptions, CookieOptions } from '../interfaces';

class NullObject implements Record<string, string | undefined> {
  [key: string]: string | undefined;

  constructor() {
    Object.setPrototypeOf(this, null);
  }
}

enum CharCode {
  Space = 0x20,
  Tab = 0x09,
}

/**
 * Parse a cookie header string into an object with cookie names as keys and their values.
 */
export const parse = (
  cookieHeader: string,
  options?: ParseOptions,
): Record<string, string | undefined> => {
  const cookies: Record<string, string | undefined> = new NullObject();
  const headerLength = cookieHeader.length;

  if (headerLength < 2) return cookies;

  const decodeValue = options?.decode || decode;
  let currentIndex = 0;

  do {
    const equalsIndex = cookieHeader.indexOf('=', currentIndex);
    if (equalsIndex === -1) break;

    const semicolonIndex = cookieHeader.indexOf(';', currentIndex);
    const segmentEndIndex =
      semicolonIndex === -1 ? headerLength : semicolonIndex;

    if (equalsIndex > segmentEndIndex) {
      currentIndex = cookieHeader.lastIndexOf(';', equalsIndex - 1) + 1;
      continue;
    }

    const keyStartIndex = skipWhitespaceStart(
      cookieHeader,
      currentIndex,
      equalsIndex,
    );
    const keyEndIndex = skipWhitespaceEnd(
      cookieHeader,
      equalsIndex,
      keyStartIndex,
    );
    const cookieName = cookieHeader.slice(keyStartIndex, keyEndIndex);

    if (cookies[cookieName] === undefined) {
      const valueStartIndex = skipWhitespaceStart(
        cookieHeader,
        equalsIndex + 1,
        segmentEndIndex,
      );
      const valueEndIndex = skipWhitespaceEnd(
        cookieHeader,
        segmentEndIndex,
        valueStartIndex,
      );

      const cookieValue = decodeValue(
        cookieHeader.slice(valueStartIndex, valueEndIndex),
      );
      cookies[cookieName] = cookieValue;
    }

    currentIndex = segmentEndIndex + 1;
  } while (currentIndex < headerLength);

  return cookies;
};

const skipWhitespaceStart = (
  input: string,
  startIndex: number,
  maxIndex: number,
): number => {
  while (startIndex < maxIndex) {
    const charCode = input.charCodeAt(startIndex);
    if (charCode !== CharCode.Space && charCode !== CharCode.Tab)
      return startIndex;
    startIndex++;
  }
  return maxIndex;
};

const skipWhitespaceEnd = (
  input: string,
  endIndex: number,
  minIndex: number,
): number => {
  while (endIndex > minIndex) {
    const charCode = input.charCodeAt(--endIndex);
    if (charCode !== CharCode.Space && charCode !== CharCode.Tab)
      return endIndex + 1;
  }
  return minIndex;
};

/**
 * Serialize a name-value pair into a cookie string with optional attributes.
 */
export const serialize = (
  cookieName: string,
  cookieValue: string,
  options?: CookieOptions,
): string => {
  const encodeValue = options?.encode || encodeURIComponent;

  if (!COOKIE_NAME_REG_EXP.test(cookieName)) {
    throw new TypeError(`Invalid cookie name: ${cookieName}`);
  }

  const encodedValue = encodeValue(cookieValue);

  if (!COOKIE_VALUE_REG_EXP.test(encodedValue)) {
    throw new TypeError(`Invalid cookie value: ${cookieValue}`);
  }

  let cookieString = `${cookieName}=${encodedValue}`;
  if (!options) return cookieString;

  const attributeHandlers: Record<string, Function> = {
    maxAge: (value: number) => {
      if (!Number.isInteger(value)) {
        throw new TypeError(`Invalid maxAge: ${value}`);
      }
      cookieString += `; Max-Age=${value}`;
    },
    domain: (value: string) => {
      if (!DOMAIN_VALUE_REG_EXP.test(value)) {
        throw new TypeError(`Invalid domain: ${value}`);
      }
      cookieString += `; Domain=${value}`;
    },
    path: (value: string) => {
      if (!PATH_VALUE_REG_EXP.test(value)) {
        throw new TypeError(`Invalid path: ${value}`);
      }
      cookieString += `; Path=${value}`;
    },
    expires: (value: Date) => {
      if (!isDate(value) || !Number.isFinite(value.valueOf())) {
        throw new TypeError(`Invalid expires: ${value}`);
      }
      cookieString += `; Expires=${value.toUTCString()}`;
    },
    httpOnly: () => {
      if (options.httpOnly) {
        cookieString += '; HttpOnly';
      }
    },
    secure: () => {
      if (options.secure) {
        cookieString += '; Secure';
      }
    },
    partitioned: () => {
      if (options.partitioned) {
        cookieString += '; Partitioned';
      }
    },
    priority: (value: string) => {
      const normalizedPriority =
        typeof value === 'string' ? value.toLowerCase() : undefined;
      if (
        normalizedPriority === Priority.LOW ||
        normalizedPriority === Priority.MEDIUM ||
        normalizedPriority === Priority.HIGH
      ) {
        cookieString += `; Priority=${normalizedPriority.charAt(0).toUpperCase() + normalizedPriority.slice(1)}`;
      } else {
        throw new TypeError(`Invalid priority: ${value}`);
      }
    },
    sameSite: (value: SameSite) => {
      if (!Object.values(SameSite).includes(value)) {
        throw new TypeError(`Invalid sameSite: ${value}`);
      }
      cookieString += `; SameSite=${value.charAt(0).toUpperCase() + value.slice(1)}`;
    },
  };

  Object.keys(options).forEach((optionKey) => {
    if (attributeHandlers[optionKey]) {
      attributeHandlers[optionKey](options[optionKey]);
    }
  });

  return cookieString;
};

/**
 * URL-decode a string value. Returns the original string if no encoding exists.
 */
const decode = (value: string): string => {
  if (!value.includes('%')) return value;

  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

/**
 * Check if a value is a valid Date object.
 */
const isDate = (value: any): value is Date => {
  return value instanceof Date;
};
