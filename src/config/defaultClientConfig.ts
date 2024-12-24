// src/config/defaultClientConfig.ts

import {
  LogLevel,
  GrantType,
  ResponseType,
  PkceMethod,
  ResponseMode,
  StorageMechanism,
  Display,
  LoginPrompt,
  UILocales,
} from '../enums';
import { IClientConfig } from '../interfaces';
import { Logger } from '../utils';

export const defaultClientConfig: Partial<IClientConfig> = {
  responseType: ResponseType.Code, // e.g., 'code'
  grantType: GrantType.AuthorizationCode, // e.g., 'authorization_code'
  pkce: true, // Enable PKCE by default
  pkceMethod: PkceMethod.S256, // Use SHA-256 for PKCE
  prompt: LoginPrompt.Consent, // e.g., 'login', 'consent'
  display: Display.PAGE, // e.g., 'page', 'popup'
  maxAge: 3600, // 1 hour
  acrValues: 'urn:mace:incommon:iap:silver', // Example ACR values
  uiLocales: [UILocales.EN_US], // Default UI locale
  additionalParams: {}, // No additional params by default
  responseMode: ResponseMode.Query, // e.g., 'query', 'fragment'
  clockSkew: 60, // 60 seconds
  tokenRefreshThreshold: 300, // 5 minutes
  timeout: 5000, // 5 seconds
  retryAttempts: 3, // Retry 3 times
  session: {
    useSilentRenew: true,
    checkSessionIframeUrl: '', // Set as needed
    sessionCheckInterval: 2000, // 2 seconds
  },
  storage: {
    mechanism: StorageMechanism.MEMORY_STORAGE, // Use in-memory storage
    prefix: 'oidc.', // Prefix for storage keys
  },
  logging: {
    logLevel: LogLevel.INFO,
    logger: new Logger('Client', LogLevel.INFO, true),
  },
};
