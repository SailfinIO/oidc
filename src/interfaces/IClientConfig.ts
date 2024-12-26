// src/interfaces/IClientConfig.ts

import {
  LogLevel,
  LoginPrompt,
  GrantType,
  ResponseType,
  PkceMethod,
  ResponseMode,
  Storage,
  Scopes,
  Display,
  UILocales,
  SameSite,
} from '../enums';
import { ILogger } from './ILogger';
import { IStore } from './IStore';

export interface IClientConfig {
  clientId: string; // Client ID
  clientSecret?: string; // Client Secret
  issuer?: string; // Issuer
  redirectUri: string; // Redirect URI
  postLogoutRedirectUri?: string; // Post-logout Redirect URI
  scopes: Scopes[] | string[]; // Scopes
  discoveryUrl: string; // Discovery URL
  responseType?: ResponseType; // e.g., 'code'
  grantType?: GrantType; // e.g., 'authorization_code'
  pkce?: boolean; // Enable PKCE
  pkceMethod?: PkceMethod; // PKCE method
  prompt?: LoginPrompt; // e.g., 'login', 'consent'
  display?: Display; // e.g., 'page', 'popup'
  maxAge?: number; // Max authentication age
  acrValues?: string; // Authentication Context Class Reference values
  uiLocales?: UILocales[]; // Preferred UI languages
  additionalParams?: Record<string, any>; // Extra authorization request parameters
  responseMode?: ResponseMode; // Response mode
  state?: string; // State parameter
  nonce?: string; // Nonce parameter
  clockSkew?: number; // Clock skew in seconds
  tokenRefreshThreshold?: number; // Token refresh threshold in seconds
  timeout?: number; // Network request timeout in ms
  retryAttempts?: number; // Number of retry attempts

  /** Session Management Configuration */
  session?: {
    /**
     * Session Store Configuration
     * Users can provide a custom store or configure predefined stores.
     */
    store?: IStore; // Allow users to inject their own store

    /**
     * Session Cookie Configuration
     * Defines how the session ID cookie should be handled.
     */
    cookie?: {
      name?: string; // Cookie name (e.g., 'sid')
      secret: string; // Secret for signing cookies if needed
      secure?: boolean; // Ensures the browser only sends the cookie over HTTPS
      httpOnly?: boolean; // Prevents JavaScript access to the cookie
      sameSite?: SameSite; // CSRF protection
      path?: string; // Cookie path
      maxAge?: number; // Cookie expiration in milliseconds
      domain?: string; // Cookie domain
    };

    useSilentRenew?: boolean;
  };

  /** Storage Configuration */
  storage?: {
    /**
     * Storage Mechanism
     * Determines the type of storage to use (e.g., MEMORY, COOKIE).
     */
    mechanism?: Storage;
    options?: any; // Specific options based on the mechanism
  };

  /** Logger Configuration */
  logging?: {
    logLevel?: LogLevel;
    logger?: ILogger;
  };
}
