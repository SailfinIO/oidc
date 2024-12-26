// src/classes/Cookie.ts

import { Priority, SameSite } from '../enums';
import {
  COOKIE_NAME_REG_EXP,
  COOKIE_VALUE_REG_EXP,
} from '../constants/cookie-constants';
import { ParseOptions, CookieOptions } from '../interfaces';
import { parse as parseCookie, serialize as serializeCookie } from '../utils';

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
    return serializeCookie(this.name, this.value, this.options);
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
    const parsed = parseCookie(cookieString, options);
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
        case 'samesite':
          const sameSiteValue = attrValue.toLowerCase();
          if (['lax', 'strict', 'none'].includes(sameSiteValue)) {
            attributeOptions.sameSite = sameSiteValue as SameSite;
          }
          break;
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
