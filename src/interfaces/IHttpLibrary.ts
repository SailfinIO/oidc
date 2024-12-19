// src/interfaces/IHttpLibrary.ts

import { RequestOptions as HttpRequestOptions } from 'http';
import { RequestOptions as HttpsRequestOptions } from 'https';
import { IncomingMessage, ClientRequest } from 'http';

export type IHttpLibrary = (
  options: HttpRequestOptions | HttpsRequestOptions,
  callback?: (res: IncomingMessage) => void,
) => ClientRequest;
