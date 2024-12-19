import { URL } from 'url';
import {
  request as httpRequest,
  RequestOptions as HttpRequestOptions,
} from 'http';
import {
  request as httpsRequest,
  RequestOptions as HttpsRequestOptions,
} from 'https';
import { IHttpLibrary } from '../interfaces/IHttpLibrary';
import { ILogger } from '../interfaces/ILogger';
import { HTTPMethod } from '../types/HTTPMethod';
import { ClientError } from '../errors/ClientError';
import { MakeRequestOptions } from '../interfaces/MakeRequestOptions';

export class HTTPClient {
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

  // Dynamically create methods for each HTTP verb
  private createMethod(method: HTTPMethod) {
    return (
      url: string,
      body?: string,
      headers?: Record<string, string>,
    ): Promise<string> => {
      if (
        ['GET', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'].includes(
          method,
        )
      ) {
        return this.makeRequest({ method, url, headers });
      }
      return this.makeRequest({ method, url, body, headers });
    };
  }

  public get = this.createMethod('GET');
  public post = this.createMethod('POST');
  public put = this.createMethod('PUT');
  public patch = this.createMethod('PATCH');
  public delete = this.createMethod('DELETE');
  public options = this.createMethod('OPTIONS');
  public head = this.createMethod('HEAD');
  public connect = this.createMethod('CONNECT');
  public trace = this.createMethod('TRACE');
}
