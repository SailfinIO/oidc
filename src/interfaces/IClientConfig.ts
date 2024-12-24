// src/interfaces/IClientConfig.ts

import {
  LogLevel,
  LoginPrompt,
  GrantType,
  ResponseType,
  PkceMethod,
  ResponseMode,
  StorageMechanism,
  Scopes,
  Display,
} from '../enums';
import { ILogger } from './ILogger';

export interface IClientConfig {
  clientId: string; // Client ID
  clientSecret?: string; // Client Secret
  issuer?: string; // Issuer
  redirectUri: string; // Redirect URI
  postLogoutRedirectUri?: string; // Post-logout Redirect URI
  scopes: Scopes[]; // Scopes
  discoveryUrl: string; // Discovery URL
  responseType?: ResponseType; // e.g., 'code'
  grantType?: GrantType; // e.g., 'authorization_code'
  pkce?: boolean; // Enable PKCE
  pkceMethod?: PkceMethod; // PKCE method
  prompt?: LoginPrompt; // e.g., 'login', 'consent'
  display?: Display; // e.g., 'page', 'popup'
  maxAge?: number; // Max authentication age
  acrValues?: string; // Authentication Context Class Reference values
  uiLocales?: string[]; // Preferred UI languages
  additionalParams?: Record<string, any>; // Extra authorization request parameters
  responseMode?: ResponseMode; // Response mode
  state?: string; // State parameter
  nonce?: string; // Nonce parameter
  clockSkew?: number; // Clock skew in seconds
  tokenRefreshThreshold?: number; // Token refresh threshold in seconds
  timeout?: number; // Network request timeout in ms
  retryAttempts?: number; // Number of retry attempts

  /** Session Management */
  session?: {
    useSilentRenew?: boolean;
    checkSessionIframeUrl?: string;
    sessionCheckInterval?: number;
  };

  /** Storage Configuration */
  storage?: {
    mechanism?: StorageMechanism;
    prefix?: string;
  };

  logging?: {
    logLevel?: LogLevel;
    logger?: ILogger;
  };
}
