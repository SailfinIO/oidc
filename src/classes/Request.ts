import { parseCookies } from '../utils';
import { RequestHeader, RequestMethod } from '../enums';
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

export class Request implements IRequest {
  private _method: Method = RequestMethod.GET;
  private _url: RequestUrl = '';
  private _originalUrl: RequestUrl = '';
  private _path: RequestPath = '';
  private _query: RequestQuery = {};
  private _params: RequestParams = {};
  private _body: RequestBody = null;
  private _headers: RequestHeaders = new Map<string, string>();
  private _cookies: RequestCookies = {};
  private _session: ISessionData | null = null;
  private _ip: RequestIp = undefined;
  private _ips: RequestIps = [];
  private _protocol: RequestProtocol = 'http';
  private _secure: boolean = false;

  // Getters
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
    this._body = body;
    return this;
  }

  public setHeaders(headers: Record<string, string>): this {
    this._headers = new Map(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );

    // Parse cookies from the headers and update the _cookies property
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
    this._ip = ip;
    return this;
  }

  public setIps(ips: RequestIps): this {
    this._ips = ips;
    return this;
  }

  public setProtocol(protocol: RequestProtocol): this {
    this._protocol = protocol;
    this._secure = protocol === 'https';
    return this;
  }

  // Utilities
  public get(header: string): string | undefined {
    return this._headers.get(header.toLowerCase());
  }

  public is(type: string): boolean {
    const contentType = this.get(RequestHeader.CONTENT_TYPE) || '';
    return contentType.includes(type);
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

  public clone(): Request {
    const clonedRequest = new Request();
    clonedRequest
      .setMethod(this._method)
      .setUrl(this._url)
      .setOriginalUrl(this._originalUrl)
      .setPath(this._path)
      .setQuery({ ...this._query })
      .setParams({ ...this._params })
      .setBody(this._body)
      .setHeaders(Object.fromEntries(this._headers))
      .setCookies({ ...this._cookies })
      .setIp(this._ip)
      .setIps([...this._ips])
      .setProtocol(this._protocol);
    if (this._session) {
      clonedRequest.setSession({ ...this._session });
    }
    return clonedRequest;
  }
}
