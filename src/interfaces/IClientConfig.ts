// src/interfaces/IClientConfig.ts

import { LogLevel } from '../enums';
import { ILogger } from './ILogger';

export interface IClientConfig {
  clientId: string; // Client ID
  clientSecret?: string; // Client Secret
  redirectUri: string; // Redirect URI
  scopes: string[]; // Scopes
  discoveryUrl: string; // Discovery URL
  responseType?: string; // e.g., 'code'
  grantType?: string; // e.g., 'authorization_code'
  pkce?: boolean; // Enable PKCE
  logLevel?: LogLevel; // Optional log level
  logger?: ILogger; // Optional custom logger
}
