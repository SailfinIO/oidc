/**
 * @fileoverview
 * Defines the `IHttpLibrary` type for making HTTP/HTTPS requests.
 * This type represents a function signature for request libraries such as Node.js's
 * built-in `http` and `https` modules, supporting configuration options and response handling.
 *
 * @module src/interfaces/IHttpLibrary
 */

import { RequestOptions as HttpRequestOptions } from 'http';
import { RequestOptions as HttpsRequestOptions } from 'https';
import { IncomingMessage, ClientRequest } from 'http';

/**
 * Represents a function signature for an HTTP/HTTPS request library.
 *
 * The `IHttpLibrary` type is used to abstract request-making capabilities, allowing for the use
 * of various HTTP/HTTPS libraries (e.g., Node.js's `http` and `https` modules) in a unified manner.
 *
 * @typedef {IHttpLibrary}
 * @function
 * @param {HttpRequestOptions | HttpsRequestOptions} options - Configuration options for the request.
 * @param {(res: IncomingMessage) => void} [callback] - Optional callback invoked when a response is received.
 * @returns {ClientRequest} A `ClientRequest` object that can be used to manage the HTTP request.
 *
 * @example
 * ```typescript
 * import { request as httpRequest } from 'http';
 * import { request as httpsRequest } from 'https';
 *
 * const httpLibrary: IHttpLibrary = (options, callback) => {
 *   const isHttps = options.protocol === 'https:';
 *   return isHttps ? httpsRequest(options, callback) : httpRequest(options, callback);
 * };
 *
 * // Example usage:
 * const options = {
 *   hostname: 'example.com',
 *   port: 443,
 *   path: '/api/data',
 *   method: 'GET',
 * };
 *
 * const req = httpLibrary(options, (res) => {
 *   res.on('data', (chunk) => console.log(chunk.toString()));
 *   res.on('end', () => console.log('Request completed.'));
 * });
 *
 * req.on('error', (err) => console.error('Request error:', err));
 * req.end();
 * ```
 */
export type IHttpLibrary = (
  options: HttpRequestOptions | HttpsRequestOptions,
  callback?: (res: IncomingMessage) => void,
) => ClientRequest;
