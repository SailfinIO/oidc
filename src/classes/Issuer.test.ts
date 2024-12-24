// src/clients/Issuer.test.ts

import { Issuer } from './Issuer';
import { ILogger, ICache, IHttp, ClientMetadata, IIssuer } from '../interfaces';
import { ClientError } from '../errors/ClientError';

describe('Issuer', () => {
  let issuer: IIssuer;
  let logger: ILogger;
  let httpClient: IHttp;
  let cache: ICache<ClientMetadata>;

  const discoveryUrl = 'https://example.com/.well-known/openid-configuration';
  const sampleConfig: Partial<ClientMetadata> = {
    issuer: 'https://example.com/',
    authorization_endpoint: 'https://example.com/oauth2/authorize',
    token_endpoint: 'https://example.com/oauth2/token',
    userinfo_endpoint: 'https://example.com/userinfo',
    jwks_uri: 'https://example.com/.well-known/jwks.json',
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Mock ILogger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };

    // Mock IHttpClient
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

    // Mock ICache<IDiscoveryConfig>
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      size: jest.fn(),
    };
  });

  describe('Constructor', () => {
    it('should initialize with provided dependencies', () => {
      issuer = new Issuer(discoveryUrl, logger, httpClient, cache, 3600000);
      expect(issuer).toBeInstanceOf(Issuer);
    });

    it('should throw ClientError if discoveryUrl is invalid', () => {
      expect(() => new Issuer('', logger)).toThrowError(ClientError);
      expect(() => new Issuer('', logger)).toThrow(
        'Invalid discovery URL provided',
      );
    });

    it('should use default HTTPClient and InMemoryCache if not provided', () => {
      issuer = new Issuer(discoveryUrl, logger);
      expect(issuer).toBeInstanceOf(Issuer);
      // Further checks can be added if necessary
    });
  });

  describe('getDiscoveryConfig', () => {
    it('should fetch config and cache it if cache is empty', async () => {
      (cache.get as jest.Mock).mockReturnValue(undefined);
      (httpClient.get as jest.Mock).mockResolvedValue(
        JSON.stringify(sampleConfig),
      );

      issuer = new Issuer(discoveryUrl, logger, httpClient, cache, 3600000);

      const config = await issuer.discoverClient();
      expect(config).toStrictEqual(sampleConfig);
      expect(cache.get).toHaveBeenCalledWith('discoveryConfig');
      expect(logger.debug).toHaveBeenCalledWith(
        'Cache miss for discovery config.',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Fetching discovery configuration.',
        {
          discoveryUrl,
        },
      );
      expect(httpClient.get).toHaveBeenCalledWith(discoveryUrl);
      expect(cache.set).toHaveBeenCalledWith(
        'discoveryConfig',
        sampleConfig,
        3600000,
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Discovery configuration fetched and cached successfully.',
      );
    });

    it('should force refresh the config even if cached', async () => {
      (cache.get as jest.Mock).mockReturnValue(sampleConfig);
      (httpClient.get as jest.Mock).mockResolvedValue(
        JSON.stringify(sampleConfig),
      );

      issuer = new Issuer(discoveryUrl, logger, httpClient, cache, 3600000);

      const config = await issuer.discoverClient(true);
      expect(config).toStrictEqual(sampleConfig); // Changed from toBe to toStrictEqual

      // Change expectation: cache.get should NOT be called when forceRefresh is true
      expect(cache.get).not.toHaveBeenCalled();

      expect(logger.debug).toHaveBeenCalledWith(
        'Force refresh enabled. Fetching discovery config.',
      );
      expect(httpClient.get).toHaveBeenCalledWith(discoveryUrl);
      expect(cache.set).toHaveBeenCalledWith(
        'discoveryConfig',
        sampleConfig,
        3600000,
      );
    });

    it('should handle concurrent fetches gracefully', async () => {
      (cache.get as jest.Mock).mockReturnValue(undefined);
      (httpClient.get as jest.Mock).mockResolvedValue(
        JSON.stringify(sampleConfig),
      );

      issuer = new Issuer(discoveryUrl, logger, httpClient, cache, 3600000);

      // Initiate two simultaneous fetches
      const [config1, config2] = await Promise.all([
        issuer.discoverClient(),
        issuer.discoverClient(),
      ]);

      expect(config1).toStrictEqual(sampleConfig); // Changed from toBe to toStrictEqual
      expect(config2).toStrictEqual(sampleConfig); // Changed from toBe to toStrictEqual
      expect(httpClient.get).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw ClientError if HTTPClient.get fails', async () => {
      (cache.get as jest.Mock).mockReturnValue(undefined);
      (httpClient.get as jest.Mock).mockRejectedValue(
        new Error('Network failure'),
      );

      issuer = new Issuer(discoveryUrl, logger, httpClient, cache, 3600000);

      await expect(issuer.discoverClient()).rejects.toMatchObject({
        message: 'Unable to fetch discovery configuration',
        code: 'DISCOVERY_ERROR',
        context: { originalError: expect.any(Error) },
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch discovery configuration.',
        {
          error: expect.any(Error),
        },
      );
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('should throw ClientError if response is invalid JSON', async () => {
      (cache.get as jest.Mock).mockReturnValue(undefined);
      (httpClient.get as jest.Mock).mockResolvedValue('invalid-json');

      issuer = new Issuer(discoveryUrl, logger, httpClient, cache, 3600000);

      await expect(issuer.discoverClient()).rejects.toMatchObject({
        message: 'Unable to fetch discovery configuration',
        code: 'DISCOVERY_ERROR',
        context: { originalError: expect.any(SyntaxError) },
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch discovery configuration.',
        {
          error: expect.any(SyntaxError),
        },
      );
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('should throw ClientError if discovery config is missing issuer', async () => {
      const invalidConfig = { ...sampleConfig };
      delete invalidConfig.issuer;

      (cache.get as jest.Mock).mockReturnValue(undefined);
      (httpClient.get as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidConfig),
      );

      issuer = new Issuer(discoveryUrl, logger, httpClient, cache, 3600000);

      await expect(issuer.discoverClient()).rejects.toMatchObject({
        message: 'Invalid discovery configuration: Missing or invalid issuer.',
        code: 'INVALID_DISCOVERY_CONFIG',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch discovery configuration.',
        {
          error: expect.any(ClientError),
        },
      );
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('should throw ClientError if discovery config is missing jwks_uri', async () => {
      const invalidConfig = { ...sampleConfig };
      delete invalidConfig.jwks_uri;

      (cache.get as jest.Mock).mockReturnValue(undefined);
      (httpClient.get as jest.Mock).mockResolvedValue(
        JSON.stringify(invalidConfig),
      );

      issuer = new Issuer(discoveryUrl, logger, httpClient, cache, 3600000);

      await expect(issuer.discoverClient()).rejects.toMatchObject({
        message:
          'Invalid discovery configuration: Missing or invalid jwks_uri.',
        code: 'INVALID_DISCOVERY_CONFIG',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch discovery configuration.',
        {
          error: expect.any(ClientError),
        },
      );
      expect(cache.set).not.toHaveBeenCalled();
    });
  });
});
