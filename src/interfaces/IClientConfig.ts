// src/interfaces/IClientConfig.ts

import { GrantType } from '../enums/GrantType';
import { LogLevel } from '../enums';
import { ILogger } from './ILogger';

export interface IClientConfig {
  clientId: string; // Client ID
  clientSecret?: string; // Client Secret
  issuer?: string; // Issuer
  redirectUri: string; // Redirect URI
  postLogoutRedirectUri?: string; // Post-logout Redirect URI
  scopes: string[]; // Scopes
  discoveryUrl: string; // Discovery URL
  responseType?: string; // e.g., 'code'
  responseTypes?: string[]; // e.g., ['code', 'id_token']
  grantType?: GrantType; // e.g., 'authorization_code'
  pkce?: boolean; // Enable PKCE
  pkceMethod?: 'plain' | 'S256'; // PKCE method
  prompt?: string; // e.g., 'login', 'consent'
  display?: string; // e.g., 'page', 'popup'
  maxAge?: number; // Max authentication age
  acrValues?: string; // Authentication Context Class Reference values
  uiLocales?: string[]; // Preferred UI languages
  additionalParams?: Record<string, any>; // Extra authorization request parameters
  responseMode?: 'query' | 'fragment' | 'form_post'; // Response mode
  state?: string; // State parameter
  nonce?: string; // Nonce parameter
  clockSkew?: number; // Clock skew in seconds
  tokenRefreshThreshold?: number; // Token refresh threshold in seconds
  timeout?: number; // Network request timeout in ms
  retryAttempts?: number; // Number of retry attempts
  enableDebug?: boolean; // Enable debug logging
  useSilentRenew?: boolean; // Enable silent token renewal
  checkSessionIframeUrl?: string; // Session management iframe URL
  sessionCheckInterval?: number; // Session check interval in ms
  storage?: 'localStorage' | 'sessionStorage' | 'memory'; // Storage mechanism
  storagePrefix?: string; // Storage key prefix
  logLevel?: LogLevel; // Optional log level
  logger?: ILogger; // Optional custom logger
}
