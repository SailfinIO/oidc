// Import necessary modules and types
import { Readable } from 'stream';
import { ContentType, StatusCode } from '../enums';
import {
  CookieOptions,
  HeaderName,
  HeaderValue,
  IResponse,
  ResponseBody,
  ResponseHeaders,
  ResponseCookies,
  ResponseStatus,
  ResponseLocation,
  ResponseRedirect,
  ResponseEnd,
} from '../interfaces';
import { serialize as serializeCookie } from '../utils/Cookie';
import { ServerResponse } from 'http';

export class Response implements IResponse {
  private _headers: Map<string, HeaderValue>;
  private _status: ResponseStatus = StatusCode.OK;
  private _cookies: Map<string, string>;
  private _body: ResponseBody = null;
  private _headersSent: boolean = false;
  private _res: ServerResponse;

  constructor(res: ServerResponse) {
    this._res = res;
    this._headers = new Map<string, HeaderValue>();
    this._cookies = new Map<string, string>();
  }

  public get headersSent(): boolean {
    return this._headersSent || this._res.headersSent;
  }

  public get cookies(): ResponseCookies {
    return this._cookies;
  }

  public get headers(): ResponseHeaders {
    return this._headers;
  }

  public get body(): ResponseBody {
    return this._body;
  }

  public getStatus(): ResponseStatus {
    return this._status;
  }

  public status(code: ResponseStatus): this {
    if (!Object.values(StatusCode).includes(code)) {
      throw new Error(`Invalid status code: ${code}`);
    }
    this._status = code;
    this._res.statusCode = code;
    return this;
  }

  public send(body: ResponseBody): this {
    if (this.headersSent) {
      throw new Error('Cannot send response, headers already sent.');
    }

    if (body instanceof Readable) {
      this._body = body;
      body.pipe(this._res);
    } else if (typeof body === 'object' && !Buffer.isBuffer(body)) {
      this.type(ContentType.JSON);
      this._body = JSON.stringify(body);
      this._res.end(this._body);
    } else {
      // Set Content-Type to text/plain for string or Buffer
      this.type(ContentType.TEXT);
      this._body = body;
      this._res.end(this._body);
    }

    this._headersSent = true;
    return this;
  }

  public json(data: object): this {
    this.type(ContentType.JSON);
    this.send(data);
    return this;
  }

  public redirect(url: string): void;
  public redirect(status: number, url: string): void;
  public redirect(statusOrUrl: number | string, url?: string): void {
    const redirectData: ResponseRedirect = {
      status: typeof statusOrUrl === 'number' ? statusOrUrl : StatusCode.FOUND,
      url: typeof statusOrUrl === 'string' ? statusOrUrl : url!,
    };
    this.status(redirectData.status);
    this.location(redirectData.url);
    this.end();
  }

  public setHeader(name: HeaderName, value: HeaderValue): this {
    if (this.headersSent) {
      throw new Error('Cannot set headers after they are sent to the client.');
    }
    this._res.setHeader(name, value);
    this._headers.set(name.toLowerCase(), value);
    return this;
  }

  public getHeader(name: HeaderName): HeaderValue | undefined {
    const header =
      this._headers.get(name.toLowerCase()) || this._res.getHeader(name);
    return typeof header === 'number' ? header.toString() : header;
  }

  public removeHeader(name: HeaderName): void {
    if (this.headersSent) {
      throw new Error(
        'Cannot remove headers after they are sent to the client.',
      );
    }
    this._res.removeHeader(name);
    this._headers.delete(name.toLowerCase());
  }

  public append(name: HeaderName, value: HeaderValue): this {
    if (this.headersSent) {
      throw new Error(
        'Cannot append headers after they are sent to the client.',
      );
    }
    const key = name.toLowerCase();
    const existing = this._headers.get(key);

    if (existing) {
      const newValue = Array.isArray(existing)
        ? [...existing, ...[].concat(value)]
        : [existing, ...[].concat(value)];
      this._res.setHeader(name, newValue);
      this._headers.set(key, newValue);
    } else {
      this._res.setHeader(name, value);
      this._headers.set(key, value);
    }
    return this;
  }

  public cookie(
    name: string,
    value: string,
    options: CookieOptions = {},
  ): this {
    if (this.headersSent) {
      throw new Error(
        'Cannot set cookies after headers are sent to the client.',
      );
    }

    // Update the internal cookies map
    this._cookies.set(name, value);

    // Serialize the cookie for the Set-Cookie header
    const cookieString = serializeCookie(name, value, options);
    this.append('Set-Cookie', cookieString);

    return this;
  }

  public clearCookie(name: string, options: CookieOptions = {}): this {
    if (this.headersSent) {
      throw new Error(
        'Cannot clear cookies after headers are sent to the client.',
      );
    }

    // Remove from the internal cookies map
    this._cookies.delete(name);

    // Append a cookie with an empty value and maxAge 0 to headers
    this.cookie(name, '', { ...options, maxAge: 0 });
    return this;
  }

  public type(contentType: ContentType): this {
    return this.setHeader('Content-Type', contentType);
  }

  public location(url: ResponseLocation): this {
    return this.setHeader('Location', url || '');
  }

  public end(body?: ResponseEnd): void {
    if (this.headersSent) {
      throw new Error('Cannot end response, headers already sent.');
    }

    if (body !== undefined) {
      this._body = body;
    }
    this.finalizeResponse();
  }

  protected finalizeResponse(): void {
    if (this._headersSent) {
      return;
    }

    // Set status code (already set in status method if called)
    this._res.statusCode = this._status || StatusCode.OK;

    // Send the body
    if (this._body !== null) {
      if (typeof this._body === 'string' || Buffer.isBuffer(this._body)) {
        this._res.end(this._body);
      } else {
        // For other types (e.g., streams), additional handling is needed
        this._res.end(String(this._body));
      }
    } else {
      this._res.end();
    }

    this._headersSent = true;
  }
}
