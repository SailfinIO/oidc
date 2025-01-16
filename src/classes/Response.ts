import { ContentType, StatusCode } from '../enums';
import {
  CookieOptions,
  HeaderName,
  HeaderValue,
  IResponse,
} from '../interfaces';
import { serialize as serializeCookie } from '../utils/Cookie';
import {
  ResponseBody,
  ResponseHeaders,
  ResponseCookies,
  ResponseStatus,
  ResponseLocation,
  ResponseRedirect,
  ResponseEnd,
} from '../interfaces';

export class Response implements IResponse {
  private _headers: ResponseHeaders | null = null;
  private _status: ResponseStatus = StatusCode.OK;
  private _cookies: ResponseCookies | null = null;
  private _body: ResponseBody = null;

  public get cookies(): ResponseCookies {
    if (!this._cookies) {
      this._cookies = new Map<string, string>();
    }
    return this._cookies;
  }

  public get headers(): ResponseHeaders {
    if (!this._headers) {
      this._headers = new Map<string, string | string[]>();
    }
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
    return this;
  }

  public send(body: ResponseBody): this {
    if (typeof body === 'object' && !Buffer.isBuffer(body)) {
      this.type(ContentType.JSON);
      this._body = JSON.stringify(body);
    } else {
      this._body = body;
    }
    this.finalizeResponse();
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
    if (!this._headers) {
      this._headers = new Map<string, HeaderValue>();
    }
    this._headers.set(name.toLowerCase(), value);
    return this;
  }

  public getHeader(name: HeaderName): HeaderValue | undefined {
    return this._headers?.get(name.toLowerCase());
  }

  public removeHeader(name: HeaderName): void {
    this._headers?.delete(name.toLowerCase());
  }

  public append(name: HeaderName, value: HeaderValue): this {
    if (!this._headers) {
      this._headers = new Map<string, HeaderValue>();
    }
    const key = name.toLowerCase();
    const existing = this._headers.get(key);
    if (existing) {
      if (Array.isArray(existing)) {
        this._headers.set(key, existing.concat(value));
      } else {
        this._headers.set(key, [existing, value].flat());
      }
    } else {
      this._headers.set(key, value);
    }
    return this;
  }

  public cookie(
    name: string,
    value: string,
    options: CookieOptions = {},
  ): this {
    if (!this._cookies) {
      this._cookies = new Map<string, string>();
    }

    // Update the internal cookies map
    this._cookies.set(name, value);

    // Serialize the cookie for the Set-Cookie header
    const cookieString = serializeCookie(name, value, options);
    this.append('Set-Cookie', cookieString);

    return this;
  }

  public clearCookie(name: string, options: CookieOptions = {}): this {
    if (!this._cookies) {
      this._cookies = new Map<string, string>();
    }

    // Remove from the internal cookies map
    this._cookies.delete(name);

    // Append a cookie with an empty value and maxAge 0 to headers
    this.cookie(name, '', { ...options, maxAge: 0 });
    return this;
  }

  public type(contentType: ContentType): this {
    this.setHeader('Content-Type', contentType);
    return this;
  }

  public location(url: ResponseLocation): this {
    this.setHeader('Location', url || '');
    return this;
  }

  public end(body?: ResponseEnd): void {
    if (body !== undefined) {
      this._body = body;
    }
    this.finalizeResponse();
  }

  protected async finalizeResponse(): Promise<void> {
    console.log('Finalizing response...');
    console.log(`Status: ${this._status}`);
    console.log(`Headers:`, Object.fromEntries(this.headers));
    console.log(`Cookies:`, Object.fromEntries(this.cookies));
    console.log(`Body:`, this.body);
  }
}
