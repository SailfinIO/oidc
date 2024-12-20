// src/clients/AuthClient.test.ts

import { AuthClient } from './AuthClient';
import {
  IDiscoveryClient,
  IDiscoveryConfig,
  IClientConfig,
  ILogger,
  IHttpClient,
} from '../interfaces';
import { GrantType } from '../enums';

describe('AuthClient', () => {
  let mockDiscoveryClient: jest.Mocked<IDiscoveryClient>;
  let httpClient: IHttpClient;
  let authClient: AuthClient;
  let logger: ILogger;
  const config: IClientConfig = {
    clientId: 'test-client-id',
    redirectUri: 'https://example.com/callback',
    scopes: ['openid', 'profile'],
    discoveryUrl: 'https://example.com/.well-known/openid-configuration',
    grantType: GrantType.AuthorizationCode,
    pkce: true,
    pkceMethod: 'S256',
  };

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };

    httpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      options: jest.fn(),
      head: jest.fn(),
      connect: jest.fn(),
      trace: jest.fn(),
    };

    mockDiscoveryClient = {
      getDiscoveryConfig: jest.fn().mockResolvedValue({
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        end_session_endpoint: 'https://auth.example.com/logout',
      }),
    };
    const mockDiscoveryConfig: IDiscoveryConfig = {
      issuer: 'https://example.com/',
      authorization_endpoint: 'https://example.com/oauth2/authorize',
      token_endpoint: 'https://example.com/oauth2/token',
      jwks_uri: 'https://example.com/.well-known/jwks.json',
      userinfo_endpoint: 'https://example.com/oauth2/userinfo',
      end_session_endpoint: 'https://example.com/oauth2/logout',
    };

    mockDiscoveryClient.getDiscoveryConfig.mockResolvedValue(
      mockDiscoveryConfig,
    );

    authClient = new AuthClient(
      config,
      logger,
      mockDiscoveryClient,
      httpClient,
    );
  });

  describe('constructor', () => {
    it('should create an instance of AuthClient', () => {
      expect(authClient).toBeInstanceOf(AuthClient);
    });
  });
});
