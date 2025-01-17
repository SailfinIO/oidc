// oidc-client-provider.ts

import {
  GrantType,
  LogLevel,
  ResponseMode,
  ResponseType,
  SameSite,
  Scopes,
  SessionMode,
  StorageMechanism,
} from '../enums';
import { Client } from '../classes';
import { IClientConfig } from '../interfaces';
import { SAILFIN_CLIENT } from '../constants/sailfinClientToken';

const isProduction =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';

export const createSailfinClient = (
  config: Partial<IClientConfig>,
): { provide: symbol; useFactory: () => Promise<Client> } => ({
  provide: SAILFIN_CLIENT,
  useFactory: async (): Promise<Client> => {
    try {
      const mergedConfig: IClientConfig = {
        clientId: process.env.SSO_CLIENT_ID || '',
        clientSecret: process.env.SSO_CLIENT_SECRET || '',
        discoveryUrl:
          process.env.SSO_DISCOVERY_URL ||
          'https://login.sailfin.io/oidc/endpoint/default/.well-known/openid-configuration',
        redirectUri:
          process.env.SSO_CALLBACK_URL ||
          'https://localhost:9443/auth/sso/callback',
        postLogoutRedirectUri:
          process.env.SSO_LOGOUT_URL ||
          'https://localhost:9443/auth/sso/logout',
        scopes: [
          Scopes.OpenId,
          Scopes.Profile,
          Scopes.Email,
          Scopes.OfflineAccess,
        ],
        grantType: GrantType.AuthorizationCode,
        responseType: ResponseType.Code,
        responseMode: ResponseMode.Query,
        session: {
          mode: SessionMode.HYBRID,
          serverStorage: StorageMechanism.MEMORY,
          clientStorage: StorageMechanism.COOKIE,
          useSilentRenew: true,
          ttl: 3600000, // 1 hour in milliseconds
          cookie: {
            name: 'auth.sid',
            secret: process.env.SESS_SECRET || 'sailfin',
            options: {
              secure: isProduction ? true : false, // Set to true in production
              httpOnly: isProduction ? true : false, // Set to true in production
              sameSite: isProduction ? SameSite.NONE : SameSite.LAX, // Use Strict SameSite for CSRF protection
              path: '/', // Root path
              maxAge: 86400000, // 24 hours
              domain: process.env.DOMAIN || undefined,
              encode: encodeURIComponent,
            },
          },
        },
        logging: { logLevel: LogLevel.INFO },
        ...config, // Merge defaults with the provided configuration
      };

      const sailfinClient = new Client(mergedConfig);
      return sailfinClient;
    } catch (error) {
      throw error;
    }
  },
});
