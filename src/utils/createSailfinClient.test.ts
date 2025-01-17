import { createSailfinClient } from './createSailfinClient';
import { Client } from '../classes';
import { SAILFIN_CLIENT } from '../constants/sailfinClientToken';

jest.mock('../classes');
jest.mock('.');

describe('createSailfinClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should provide the SAILFIN_CLIENT token', () => {
    const result = createSailfinClient({});
    expect(result.provide).toBe(SAILFIN_CLIENT);
  });

  it('should create a Client instance with default config', async () => {
    const mockClient = new Client({} as any);
    (Client as jest.Mock).mockImplementation(() => mockClient);

    const result = createSailfinClient({});
    const client = await result.useFactory();

    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: '',
        clientSecret: '',
        discoveryUrl:
          'https://login.sailfin.io/oidc/endpoint/default/.well-known/openid-configuration',
        redirectUri: 'https://localhost:9443/auth/sso/callback',
        postLogoutRedirectUri: 'https://localhost:9443/auth/sso/logout',
        scopes: expect.arrayContaining([
          'openid',
          'profile',
          'email',
          'offline_access',
        ]),
        grantType: 'authorization_code',
        responseType: 'code',
        responseMode: 'query',
        session: expect.objectContaining({
          mode: 'hybrid',
          serverStorage: 'memory',
          clientStorage: 'cookie',
          useSilentRenew: true,
          ttl: 3600000,
          cookie: expect.objectContaining({
            name: 'auth.sid',
            secret: 'sailfin',
            options: expect.objectContaining({
              secure: false,
              httpOnly: false,
              sameSite: 'lax',
              path: '/',
              maxAge: 86400000,
              domain: undefined,
              encode: encodeURIComponent,
            }),
          }),
        }),
        logging: expect.objectContaining({ logLevel: 'info' }),
      }),
    );
    expect(client).toBe(mockClient);
  });

  it('should merge provided config with default config', async () => {
    const mockClient = new Client({} as any);
    (Client as jest.Mock).mockImplementation(() => mockClient);

    const customConfig = {
      clientId: 'custom-client-id',
      clientSecret: 'custom-client-secret',
    };

    const result = createSailfinClient(customConfig);
    const client = await result.useFactory();

    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'custom-client-id',
        clientSecret: 'custom-client-secret',
      }),
    );
    expect(client).toBe(mockClient);
  });

  it('should log an error if client initialization fails', async () => {
    const error = new Error('Initialization failed');
    (Client as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const result = createSailfinClient({});

    await expect(result.useFactory()).rejects.toThrow(error);
  });
});
