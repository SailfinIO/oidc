/**
 * @fileoverview
 * Defines the `HTTPMethod` type representing standard HTTP methods.
 * This type ensures strict type-checking for supported HTTP methods in request-handling functions.
 *
 * @module src/types/HTTPMethod
 */

/**
 * Represents standard HTTP methods.
 *
 * The `HTTPMethod` type is a union of string literals that correspond to the
 * HTTP methods commonly used in web development. This type provides a strict
 * contract for functions and classes that handle HTTP requests, ensuring only
 * valid methods are used.
 *
 * @typedef {HTTPMethod}
 * @type {'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'CONNECT' | 'TRACE'}
 *
 * @example
 * ```typescript
 * import { HTTPMethod } from './types/HTTPMethod';
 *
 * function makeRequest(method: HTTPMethod, url: string): void {
 *   console.log(`Making a ${method} request to ${url}`);
 * }
 *
 * makeRequest('GET', 'https://api.example.com/data'); // Valid
 * makeRequest('INVALID', 'https://api.example.com/data'); // TypeScript Error
 * ```
 */
export type HTTPMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD'
  | 'CONNECT'
  | 'TRACE';
