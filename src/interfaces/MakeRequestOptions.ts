/**
 * @fileoverview
 * Defines the `MakeRequestOptions` interface for configuring HTTP requests.
 * This interface specifies the options required for making HTTP requests,
 * including the method, URL, headers, and optional body.
 *
 * @module src/interfaces/MakeRequestOptions
 */

import { HTTPMethod } from '../types/HTTPMethod';

/**
 * Represents the options required to make an HTTP request.
 *
 * The `MakeRequestOptions` interface provides a structured way to configure
 * HTTP requests, specifying the HTTP method, target URL, optional request body,
 * and custom headers.
 *
 * @interface MakeRequestOptions
 */
export interface MakeRequestOptions {
  /**
   * The HTTP method for the request (e.g., "GET", "POST").
   *
   * @type {HTTPMethod}
   * @example
   * ```typescript
   * const options: MakeRequestOptions = {
   *   method: 'POST',
   *   url: 'https://api.example.com/resource',
   *   body: JSON.stringify({ key: 'value' }),
   *   headers: { 'Content-Type': 'application/json' },
   * };
   * ```
   */
  method: HTTPMethod;

  /**
   * The target URL for the HTTP request.
   *
   * @type {string}
   * @example
   * ```typescript
   * const options: MakeRequestOptions = {
   *   method: 'GET',
   *   url: 'https://api.example.com/data',
   * };
   * ```
   */
  url: string;

  /**
   * Optional body payload for methods like "POST", "PUT", or "PATCH".
   *
   * @type {string | undefined}
   * @example
   * ```typescript
   * const options: MakeRequestOptions = {
   *   method: 'POST',
   *   url: 'https://api.example.com/resource',
   *   body: JSON.stringify({ key: 'value' }),
   * };
   * ```
   */
  body?: string;

  /**
   * Optional headers to include in the HTTP request.
   *
   * Headers are specified as key-value pairs, where the key is the header name
   * (e.g., "Content-Type") and the value is the header value.
   *
   * @type {Record<string, string> | undefined}
   * @example
   * ```typescript
   * const options: MakeRequestOptions = {
   *   method: 'GET',
   *   url: 'https://api.example.com/data',
   *   headers: { Authorization: 'Bearer my-token' },
   * };
   * ```
   */
  headers?: Record<string, string>;
}
