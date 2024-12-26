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

/**
 * Represents a single HTTP cookie with its attributes.
 */
export class Cookie {
  name: string;
  value: string;
  options?: CookieOptions;

  /**
   * Creates a new Cookie instance.
   *
   * @param name - The name of the cookie.
   * @param value - The value of the cookie.
   * @param options - Optional attributes for the cookie.
   *
   * @throws {TypeError} If the cookie name or value is invalid.
   *
   * @example
   * const cookie = new Cookie('sessionId', 'abc123', { httpOnly: true, secure: true });
   */
  constructor(name: string, value: string, options?: CookieOptions) {
    if (!COOKIE_NAME_REG_EXP.test(name)) {
      throw new TypeError(`Invalid cookie name: ${name}`);
    }
    if (!COOKIE_VALUE_REG_EXP.test(value)) {
      throw new TypeError(`Invalid cookie value: ${value}`);
    }

    this.name = name;
    this.value = value;
    this.options = options;
  }

  /**
   * Serializes the cookie into a string suitable for the `Set-Cookie` HTTP header.
   *
   * @returns The serialized cookie string.
   *
   * @example
   * const serialized = cookie.serialize();
   * // Output: "sessionId=abc123; HttpOnly; Secure"
   */
  serialize(): string {
    return serialize(this.name, this.value, this.options);
  }

  /**
   * Parses a cookie string and returns a corresponding Cookie instance.
   *
   * @param cookieString - The raw `Set-Cookie` string.
   * @param options - Optional attributes for parsing.
   *
   * @returns A new Cookie instance or `null` if parsing fails.
   *
   * @example
   * const parsedCookie = Cookie.parse('sessionId=abc123; HttpOnly; Secure');
   */
  static parse(cookieString: string, options?: ParseOptions): Cookie | null {
    const parsed = parse(cookieString, options);
    const name = Object.keys(parsed)[0];
    const value = parsed[name];

    if (!name || value === undefined) {
      return null;
    }

    // Extract options from the cookie string
    const attributeOptions: CookieOptions = {};

    const attributes = cookieString
      .split(';')
      .slice(1)
      .map((attr) => attr.trim());
    attributes.forEach((attr) => {
      const [attrName, attrValue] = attr.split('=');
      switch (attrName.toLowerCase()) {
        case 'max-age':
          attributeOptions.maxAge = Number(attrValue);
          break;
        case 'domain':
          attributeOptions.domain = attrValue;
          break;
        case 'path':
          attributeOptions.path = attrValue;
          break;
        case 'expires':
          attributeOptions.expires = new Date(attrValue);
          break;
        case 'httponly':
          attributeOptions.httpOnly = true;
          break;
        case 'secure':
          attributeOptions.secure = true;
          break;
        case 'partitioned':
          attributeOptions.partitioned = true;
          break;
        case 'priority':
          attributeOptions.priority = attrValue.toLowerCase() as Priority;
          break;
        case 'samesite': {
          const sameSiteValue = attrValue.toLowerCase();
          if (['lax', 'strict', 'none'].includes(sameSiteValue)) {
            attributeOptions.sameSite = sameSiteValue as SameSite;
          }
          break;
        }
        default:
          break;
      }
    });

    return new Cookie(name, value, attributeOptions);
  }

  /**
   * Converts the Cookie instance to a plain object.
   *
   * @returns An object representation of the cookie.
   *
   * @example
   * const cookieObj = cookie.toJSON();
   * // Output: { name: 'sessionId', value: 'abc123', options: { httpOnly: true, secure: true } }
   */
  toJSON(): { name: string; value: string; options?: CookieOptions } {
    return {
      name: this.name,
      value: this.value,
      options: this.options,
    };
  }

  /**
   * Updates the value of the cookie.
   *
   * @param newValue - The new value to set.
   *
   * @throws {TypeError} If the new value is invalid.
   *
   * @example
   * cookie.setValue('newValue123');
   */
  setValue(newValue: string): void {
    if (!COOKIE_VALUE_REG_EXP.test(newValue)) {
      throw new TypeError(`Invalid cookie value: ${newValue}`);
    }
    this.value = newValue;
  }

  /**
   * Updates the options of the cookie.
   *
   * @param newOptions - The new options to set.
   *
   * @example
   * cookie.setOptions({ secure: false });
   */
  setOptions(newOptions: CookieOptions): void {
    this.options = { ...this.options, ...newOptions };
  }
}
