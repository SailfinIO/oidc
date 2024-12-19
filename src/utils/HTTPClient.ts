import { ClientError } from '../errors/ClientError';
import { Logger } from './Logger';
import { LogLevel } from '../enums';
import { URL } from 'url';

export class HTTPClient {
  private static logger = new Logger(HTTPClient.name, LogLevel.INFO, false);

  public static get(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const lib =
        urlObj.protocol === 'https:' ? require('https') : require('http');

      const options = {
        method: 'GET',
        headers,
      };

      const req = lib.request(urlObj, options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            HTTPClient.logger.error(
              `HTTP GET request failed with status ${res.statusCode}`,
              { body: data },
            );
            reject(
              new ClientError(
                `HTTP GET request failed with status ${res.statusCode}`,
                'HTTP_ERROR',
              ),
            );
          }
        });
      });

      req.on('error', (err: any) => {
        HTTPClient.logger.error('HTTP GET request encountered an error', err);
        reject(
          new ClientError(
            'HTTP GET request encountered an error',
            'HTTP_ERROR',
          ),
        );
      });

      req.end();
    });
  }

  public static post(
    url: string,
    body: string,
    headers: Record<string, string> = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const lib =
        urlObj.protocol === 'https:' ? require('https') : require('http');

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        },
      };

      const req = lib.request(urlObj, options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            HTTPClient.logger.error(
              `HTTP POST request failed with status ${res.statusCode}`,
              { body: data },
            );
            reject(
              new ClientError(
                `HTTP POST request failed with status ${res.statusCode}`,
                'HTTP_ERROR',
              ),
            );
          }
        });
      });

      req.on('error', (err: any) => {
        HTTPClient.logger.error('HTTP POST request encountered an error', err);
        reject(
          new ClientError(
            'HTTP POST request encountered an error',
            'HTTP_ERROR',
          ),
        );
      });

      req.write(body);
      req.end();
    });
  }
}
