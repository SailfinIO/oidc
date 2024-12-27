// src/config/defaultClientConfig.ts

import {
  LogLevel,
  GrantType,
  ResponseType,
  PkceMethod,
  ResponseMode,
  Storage,
  Display,
  LoginPrompt,
  UILocales,
  SameSite,
} from '../enums';
import { IClientConfig } from '../interfaces';
import { Logger } from '../utils';

export const defaultClientConfig: Partial<IClientConfig> = {
  responseType: ResponseType.Code, // Default to 'code'
  grantType: GrantType.AuthorizationCode, // Use Authorization Code Grant
  pkce: true, // PKCE enabled by default
  pkceMethod: PkceMethod.S256, // SHA-256 PKCE Method
  prompt: LoginPrompt.Consent, // Default login prompt
  display: Display.PAGE, // Default display mode
  maxAge: 3600, // Max authentication age (1 hour)
  acrValues: 'urn:mace:incommon:iap:silver', // Example ACR value
  uiLocales: [UILocales.EN_US], // Default UI locale
  additionalParams: {}, // No additional params
  responseMode: ResponseMode.Query, // Use 'query' response mode
  clockSkew: 60, // Allow 60 seconds clock skew
  tokenRefreshThreshold: 300, // Refresh 5 minutes before expiration
  timeout: 5000, // Network timeout of 5 seconds
  retryAttempts: 3, // Retry 3 times for failed requests

  session: {
    useSilentRenew: true, // Enable silent token renewal
    store: undefined, // Default to no custom store
    cookie: {
      name: 'sid', // Default session ID cookie name
      secret: 'default-secret', // Replace with a secure secret in production
      secure: true, // Send cookie over HTTPS only
      httpOnly: true, // Prevent JavaScript access
      sameSite: SameSite.STRICT, // CSRF protection
      path: '/', // Default path for the cookie
      maxAge: 3600000, // Cookie expiration (1 hour)
      domain: undefined, // Domain not set by default
    },
  },

  storage: {
    mechanism: Storage.MEMORY, // Default to in-memory storage
    options: {}, // No additional options by default
  },

  logging: {
    logLevel: LogLevel.INFO, // Default log level
    logger: new Logger('Client', LogLevel.INFO, true), // Default logger
  },
};
