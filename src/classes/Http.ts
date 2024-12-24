/**
 * @fileoverview
 * Implements the `IHttp` interface for making HTTP requests.
 * This class supports all standard HTTP methods, allowing custom headers and body payloads.
 * It uses the built-in Node.js `http` and `https` libraries by default, but can be configured
 * with a custom HTTP library.
 *
 * @module src/clients/Http
 */

import { URL } from 'url';
import {
  request as httpRequest,
  RequestOptions as HttpRequestOptions,
} from 'http';
import {
  request as httpsRequest,
  RequestOptions as HttpsRequestOptions,
} from 'https';
import {
  ILogger,
  IHttp,
  IHttpLibrary,
  MakeRequestOptions,
} from '../interfaces';
import { HTTPMethod } from '../types/HTTPMethod';
import { ClientError } from '../errors/ClientError';

/**
 * Represents an HTTP client for making HTTP requests.
 *
 * The `Http` class implements the `IHttp` interface and provides methods
 * for performing HTTP requests using standard or custom HTTP libraries.
 *
 * @class Http
 */
export class Http implements IHttp {
  /**
   * Logger instance for logging HTTP request details and errors.
   *
   * @private
   * @readonly
   * @type {ILogger}
   */
  private readonly logger: ILogger;

  /**
   * Optional custom HTTP library for making requests.
   *
   * @private
   * @readonly
   * @type {IHttpLibrary | undefined}
   */
  private readonly httpLib?: IHttpLibrary;

  /**
   * Creates an instance of Http.
   *
   * @param {ILogger} logger - Logger instance for logging operations and errors.
   * @param {IHttpLibrary} [httpLib] - Optional custom HTTP library for making requests.
   */
  constructor(logger: ILogger, httpLib?: IHttpLibrary) {
    this.logger = logger;
    this.httpLib = httpLib;
  }

  /**
   * Selects the appropriate HTTP library based on the URL protocol.
   *
   * @private
   * @param {string} protocol - The URL protocol (e.g., "http:" or "https:").
   * @returns {IHttpLibrary} The appropriate HTTP library.
   */
  private getHttpLibrary(protocol: string): IHttpLibrary {
    return this.httpLib ?? (protocol === 'https:' ? httpsRequest : httpRequest);
  }

  /**
   * Builds request options for the HTTP/HTTPS library.
   *
   * @private
   * @param {URL} urlObj - Parsed URL object.
   * @param {HTTPMethod} method - HTTP method (e.g., "GET", "POST").
   * @param {Record<string, string>} headers - Headers to include in the request.
   * @returns {HttpRequestOptions | HttpsRequestOptions} The built request options.
   */
  private buildRequestOptions(
    urlObj: URL,
    method: HTTPMethod,
    headers: Record<string, string>,
  ): HttpRequestOptions | HttpsRequestOptions {
    const isHttps = urlObj.protocol === 'https:';
    return {
      method,
      headers,
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: `${urlObj.pathname}${urlObj.search}`,
    };
  }

  /**
   * Makes an HTTP request with the specified options.
   *
   * @private
   * @param {MakeRequestOptions} options - Options for making the request, including method, URL, body, and headers.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   * @throws {ClientError} If the request fails or the response status indicates an error.
   */
  private makeRequest({
    method,
    url,
    body,
    headers = {},
  }: MakeRequestOptions): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      try {
        const urlObj = new URL(url);
        const lib = this.getHttpLibrary(urlObj.protocol);
        const options = this.buildRequestOptions(urlObj, method, headers);

        const req = lib(options, (res) => {
          let data = '';

          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });

          res.on('end', () => {
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              this.logger.info(`HTTP ${method} request to ${url} succeeded`, {
                statusCode: res.statusCode,
              });
              resolve(data);
            } else {
              this.logger.error(
                `HTTP ${method} request to ${url} failed with status ${res.statusCode}`,
                { body: data },
              );
              reject(
                new ClientError(
                  `HTTP ${method} request failed with status ${res.statusCode}`,
                  'HTTP_ERROR',
                  { statusCode: res.statusCode, body: data },
                ),
              );
            }
          });
        });

        req.on('error', (err: Error) => {
          this.logger.error(
            `HTTP ${method} request to ${url} encountered an error`,
            err,
          );
          reject(
            new ClientError(
              `HTTP ${method} request encountered an error`,
              'HTTP_ERROR',
              { originalError: err },
            ),
          );
        });

        if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
          req.write(body);
        }

        req.end();
      } catch (error) {
        this.logger.error(
          `Failed to make HTTP ${method} request to ${url}`,
          error,
        );
        reject(
          new ClientError(
            `Failed to make HTTP ${method} request to ${url}`,
            'REQUEST_SETUP_ERROR',
            { originalError: error },
          ),
        );
      }
    });
  }

  /**
   * Sends a GET request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   */
  public get(url: string, headers?: Record<string, string>): Promise<string> {
    return this.makeRequest({ method: 'GET', url, headers });
  }

  /**
   * Sends a DELETE request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   */
  public delete(
    url: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'DELETE', url, headers });
  }

  /**
   * Sends a HEAD request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response headers as a string.
   */
  public head(url: string, headers?: Record<string, string>): Promise<string> {
    return this.makeRequest({ method: 'HEAD', url, headers });
  }

  /**
   * Sends an OPTIONS request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   */
  public options(
    url: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'OPTIONS', url, headers });
  }

  /**
   * Sends a TRACE request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   */
  public trace(url: string, headers?: Record<string, string>): Promise<string> {
    return this.makeRequest({ method: 'TRACE', url, headers });
  }

  /**
   * Sends a CONNECT request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   */
  public connect(
    url: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'CONNECT', url, headers });
  }

  /**
   * Sends a POST request to the specified URL with a request body.
   *
   * @param {string} url - The URL to send the request to.
   * @param {string} body - The request body to include in the POST request.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   */
  public post(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'POST', url, body, headers });
  }

  /**
   * Sends a PUT request to the specified URL with a request body.
   *
   * @param {string} url - The URL to send the request to.
   * @param {string} body - The request body to include in the PUT request.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   */
  public put(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'PUT', url, body, headers });
  }

  /**
   * Sends a PATCH request to the specified URL with a request body.
   *
   * @param {string} url - The URL to send the request to.
   * @param {string} body - The request body to include in the PATCH request.
   * @param {Record<string, string>} [headers] - Optional headers to include in the request.
   * @returns {Promise<string>} A promise that resolves to the response body as a string.
   */
  public patch(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'PATCH', url, body, headers });
  }
}
