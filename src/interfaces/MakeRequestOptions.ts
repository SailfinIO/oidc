// src/interfaces/MakeRequestOptions.ts

import { HTTPMethod } from '../types/HTTPMethod';

export interface MakeRequestOptions {
  method: HTTPMethod;
  url: string;
  body?: string;
  headers?: Record<string, string>;
}
