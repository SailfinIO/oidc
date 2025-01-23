// Import necessary modules and types
import { parseCookies } from '../utils';
import { ContentType, RequestHeader, RequestMethod } from '../enums';
import {
  IRequest,
  ISessionData,
  Method,
  RequestBody,
  RequestCookies,
  RequestHeaders,
  RequestIp,
  RequestIps,
  RequestParams,
  RequestPath,
  RequestProtocol,
  RequestQuery,
  RequestUrl,
} from '../interfaces';
import { isIP } from 'net';
import { TLSSocket } from 'tls';
import { IncomingMessage } from 'http';
import { URL } from 'url';

export class Request implements IRequest {
  // Properties
  private _method: Method = RequestMethod.GET;
  private _url: RequestUrl = '';
  private _originalUrl: RequestUrl = '';
  private _path: RequestPath = '';
  private _query: RequestQuery = {};
  private _params: RequestParams = {};
  private _body: RequestBody = null;
  private _headers: RequestHeaders = new Map<string, string | string[]>();
  private _cookies: RequestCookies = {};
  private _session: ISessionData | null = null;
  private _ip: RequestIp = undefined;
  private _ips: RequestIps = [];
  private _protocol: RequestProtocol = 'http';
  private _secure: boolean = false;

  // Public Getters
  public get method(): Method {
    return this._method;
  }

  public get url(): RequestUrl {
    return this._url;
  }

  public get originalUrl(): RequestUrl {
    return this._originalUrl;
  }

  public get path(): RequestPath {
    return this._path;
  }

  public get query(): RequestQuery {
    return this._query;
  }

  public get params(): RequestParams {
    return this._params;
  }

  public get body(): RequestBody {
    return this._body;
  }

  public get headers(): RequestHeaders {
    return this._headers;
  }

  public get cookies(): RequestCookies {
    return this._cookies;
  }

  public get session(): ISessionData | null {
    return this._session;
  }

  public get ip(): RequestIp {
    return this._ip;
  }

  public get ips(): RequestIps {
    return this._ips;
  }

  public get protocol(): RequestProtocol {
    return this._protocol;
  }

  public get secure(): boolean {
    return this._secure;
  }

  // Constructor with Overloading
  constructor(req: IncomingMessage);
  constructor();
  constructor(req?: IncomingMessage) {
    if (req) {
      const protocol = req.socket instanceof TLSSocket ? 'https' : 'http';

      // Determine host
      const host = req.headers.host || 'localhost';

      // Parse URL using WHATWG URL API
      const url = new URL(req.url || '', `${protocol}://${host}`);

      // Initialize properties
      this.setMethod(req.method as Method)
        .setUrl(url.href)
        .setOriginalUrl(url.href)
        .setPath(url.pathname)
        .setQuery(Object.fromEntries(url.searchParams.entries()))
        .setHeaders(req.headers as Record<string, string | string[]>)
        .setIp(req.socket.remoteAddress)
        .setProtocol(protocol)
        .parseBody(req);

      // Parse IP addresses from X-Forwarded-For header
      const forwardedFor = this.get(RequestHeader.X_FORWARDED_FOR);
      if (forwardedFor) {
        if (typeof forwardedFor === 'string') {
          this._ips = forwardedFor.split(',').map((ip) => ip.trim());
        } else if (Array.isArray(forwardedFor)) {
          this._ips = forwardedFor.map((ip) => ip.trim());
        }
        this._ip = this._ips[0];
      }
    }
  }

  // Setters
  public setMethod(method: Method): this {
    this._method = method;
    return this;
  }

  public setUrl(url: RequestUrl): this {
    this._url = url;
    return this;
  }

  public setOriginalUrl(originalUrl: RequestUrl): this {
    this._originalUrl = originalUrl;
    return this;
  }

  public setPath(path: RequestPath): this {
    this._path = path;
    return this;
  }

  public setQuery(query: RequestQuery): this {
    this._query = query;
    return this;
  }

  public setParams(params: RequestParams): this {
    this._params = params;
    return this;
  }

  public setBody(body: RequestBody): this {
    const contentType = this.get(RequestHeader.CONTENT_TYPE) || '';

    if (typeof body === 'string' && contentType.includes(ContentType.JSON)) {
      try {
        this._body = JSON.parse(body);
      } catch (error) {
        throw new Error('Invalid JSON body');
      }
    } else {
      this._body = body;
    }
    return this;
  }

  public setHeaders(headers: Record<string, string | string[]>): this {
    for (const [key, value] of Object.entries(headers)) {
      this._headers.set(key.toLowerCase(), value);
    }

    // Re-parse cookies whenever headers are updated
    this._cookies = parseCookies(this._headers);
    return this;
  }

  public setCookies(cookies: RequestCookies): this {
    this._cookies = cookies;
    return this;
  }

  public setSession(session: ISessionData): this {
    this._session = session;
    return this;
  }

  public setIp(ip: RequestIp): this {
    if (ip && !isIP(ip)) {
      throw new Error('Invalid IP address format');
    }
    this._ip = ip;
    return this;
  }

  public setIps(ips: RequestIps): this {
    if (ips && ips.some((ip) => !isIP(ip))) {
      throw new Error('One or more IP addresses have an invalid format');
    }
    this._ips = ips;
    return this;
  }

  public setProtocol(protocol?: RequestProtocol): this {
    if (!protocol) {
      const forwardedProto = this.get(RequestHeader.X_FORWARDED_PROTO);
      this._protocol = (forwardedProto || 'http') as RequestProtocol;
    } else {
      if (!['http', 'https'].includes(protocol)) {
        throw new Error(`Unsupported protocol: ${protocol}`);
      }
      this._protocol = protocol;
    }
    this._secure = this._protocol === 'https';
    return this;
  }

  // Utility Methods
  public get(header: string): string | string[] | undefined {
    return this._headers.get(header.toLowerCase());
  }

  public is(type: string): boolean {
    const contentType = this.get(RequestHeader.CONTENT_TYPE) || '';
    let mimeType = '';

    if (typeof contentType === 'string') {
      mimeType = contentType.split(';')[0].trim();
    } else if (Array.isArray(contentType)) {
      mimeType = contentType[0].split(';')[0].trim(); // Take the first Content-Type if multiple
    }

    return mimeType === type;
  }

  public hasHeader(header: string): boolean {
    return this._headers.has(header.toLowerCase());
  }

  public accepts(types: string | string[]): string | false {
    const acceptHeader = this.get(RequestHeader.ACCEPT) || '';
    const typesArray = Array.isArray(types) ? types : [types];

    for (const type of typesArray) {
      if (acceptHeader.includes(type)) {
        return type;
      }
    }
    return false;
  }

  // Asynchronous Body Parsing
  public async parseBody(req: IncomingMessage): Promise<this> {
    return new Promise((resolve, reject) => {
      let data = '';

      req.on('data', (chunk) => {
        data += chunk;
      });

      req.on('end', () => {
        try {
          this.setBody(data);
          resolve(this);
        } catch (error) {
          reject(error);
        }
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Cloning Method
  public clone(): this {
    const clonedRequest = new Request(); // Allowed due to overloaded constructor

    clonedRequest
      .setMethod(this._method)
      .setUrl(this._url)
      .setOriginalUrl(this._originalUrl)
      .setPath(this._path)
      .setQuery(JSON.parse(JSON.stringify(this._query)))
      .setParams(JSON.parse(JSON.stringify(this._params)))
      .setBody(
        this._body instanceof Buffer
          ? Buffer.from(this._body)
          : typeof this._body === 'object'
            ? JSON.parse(JSON.stringify(this._body))
            : this._body,
      )
      .setHeaders(Object.fromEntries(this._headers))
      .setCookies(JSON.parse(JSON.stringify(this._cookies)))
      .setIp(this._ip)
      .setIps([...this._ips])
      .setProtocol(this._protocol);

    if (this._session) {
      clonedRequest.setSession(JSON.parse(JSON.stringify(this._session)));
    }

    return clonedRequest as this;
  }
}
