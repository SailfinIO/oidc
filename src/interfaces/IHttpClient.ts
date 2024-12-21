/**
 * @fileoverview
 * Defines the `IHttpClient` interface for making HTTP requests.
 * This interface provides a contract for implementing an HTTP client with
 * methods for standard HTTP operations such as GET, POST, PUT, DELETE, etc.
 *
 * @module src/interfaces/IHttpClient
 */

/**
 * Represents a generic HTTP client interface for making HTTP requests.
 *
 * The `IHttpClient` interface provides methods corresponding to standard HTTP
 * methods. Each method returns a `Promise` resolving to the response body as a string.
 *
 * @interface IHttpClient
 */
export interface IHttpClient {
  /**
   * Sends a GET request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   * @example
   * ```typescript
   * const response = await httpClient.get('https://api.example.com/data');
   * console.log(response);
   * ```
   */
  get(url: string, headers?: Record<string, string>): Promise<string>;

  /**
   * Sends a POST request to the specified URL with a request body.
   *
   * @param {string} url - The URL to send the request to.
   * @param {string} body - The request body to include in the POST request.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   * @example
   * ```typescript
   * const response = await httpClient.post(
   *   'https://api.example.com/data',
   *   JSON.stringify({ key: 'value' }),
   *   { 'Content-Type': 'application/json' }
   * );
   * console.log(response);
   * ```
   */
  post(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string>;

  /**
   * Sends a PUT request to the specified URL with a request body.
   *
   * @param {string} url - The URL to send the request to.
   * @param {string} body - The request body to include in the PUT request.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   * @example
   * ```typescript
   * const response = await httpClient.put(
   *   'https://api.example.com/resource/1',
   *   JSON.stringify({ key: 'updatedValue' }),
   *   { 'Content-Type': 'application/json' }
   * );
   * console.log(response);
   * ```
   */
  put(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string>;

  /**
   * Sends a PATCH request to the specified URL with a request body.
   *
   * @param {string} url - The URL to send the request to.
   * @param {string} body - The request body to include in the PATCH request.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   * @example
   * ```typescript
   * const response = await httpClient.patch(
   *   'https://api.example.com/resource/1',
   *   JSON.stringify({ key: 'patchedValue' }),
   *   { 'Content-Type': 'application/json' }
   * );
   * console.log(response);
   * ```
   */
  patch(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string>;

  /**
   * Sends a DELETE request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   * @example
   * ```typescript
   * const response = await httpClient.delete('https://api.example.com/resource/1');
   * console.log(response);
   * ```
   */
  delete(url: string, headers?: Record<string, string>): Promise<string>;

  /**
   * Sends an OPTIONS request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   * @example
   * ```typescript
   * const response = await httpClient.options('https://api.example.com/resource');
   * console.log(response);
   * ```
   */
  options(url: string, headers?: Record<string, string>): Promise<string>;

  /**
   * Sends a HEAD request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response headers as a string.
   * @example
   * ```typescript
   * const response = await httpClient.head('https://api.example.com/resource');
   * console.log(response);
   * ```
   */
  head(url: string, headers?: Record<string, string>): Promise<string>;

  /**
   * Sends a CONNECT request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   * @example
   * ```typescript
   * const response = await httpClient.connect('https://api.example.com/resource');
   * console.log(response);
   * ```
   */
  connect(url: string, headers?: Record<string, string>): Promise<string>;

  /**
   * Sends a TRACE request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   * @example
   * ```typescript
   * const response = await httpClient.trace('https://api.example.com/resource');
   * console.log(response);
   * ```
   */
  trace(url: string, headers?: Record<string, string>): Promise<string>;
}
