// src/interfaces/IHttpClient.ts
export interface IHttpClient {
  get(url: string, headers?: Record<string, string>): Promise<string>;
  post(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string>;
  put(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string>;
  patch(
    url: string,
    body: string,
    headers?: Record<string, string>,
  ): Promise<string>;
  delete(url: string, headers?: Record<string, string>): Promise<string>;
  options(url: string, headers?: Record<string, string>): Promise<string>;
  head(url: string, headers?: Record<string, string>): Promise<string>;
  connect(url: string, headers?: Record<string, string>): Promise<string>;
  trace(url: string, headers?: Record<string, string>): Promise<string>;
}
