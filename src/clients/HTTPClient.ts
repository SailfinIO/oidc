// src/clients/HTTPClient.ts
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
  IHttpClient,
  IHttpLibrary,
  MakeRequestOptions,
} from '../interfaces';
import { HTTPMethod } from '../types/HTTPMethod';
import { ClientError } from '../errors/ClientError';

export class HTTPClient implements IHttpClient {
  private logger: ILogger;
  private httpLib?: IHttpLibrary;

  constructor(logger: ILogger, httpLib?: IHttpLibrary) {
    this.logger = logger;
    this.httpLib = httpLib;
  }

  private getHttpLibrary(protocol: string): IHttpLibrary {
    return this.httpLib ?? (protocol === 'https:' ? httpsRequest : httpRequest);
  }

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

  // Define methods without 'body' parameter
  public get(url: string, headers?: Record<string, string>): Promise<string> {
    return this.makeRequest({ method: 'GET', url, headers });
  }

  public delete(
    url: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'DELETE', url, headers });
  }

  public head(url: string, headers?: Record<string, string>): Promise<string> {
    return this.makeRequest({ method: 'HEAD', url, headers });
  }

  public options(
    url: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'OPTIONS', url, headers });
  }

  public trace(url: string, headers?: Record<string, string>): Promise<string> {
    return this.makeRequest({ method: 'TRACE', url, headers });
  }

  public connect(
    url: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'CONNECT', url, headers });
  }

  // Define methods with 'body' parameter
  public post(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'POST', url, body, headers });
  }

  public put(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'PUT', url, body, headers });
  }

  public patch(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.makeRequest({ method: 'PATCH', url, body, headers });
  }
}
