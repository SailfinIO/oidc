// src/clients/JwksClient.test.ts
import { JwksClient } from './JwksClient'; // Adjust the import path as necessary
import { ILogger, ICache, IHttpClient, Jwk, JwksResponse } from '../interfaces';
import { ClientError } from '../errors/ClientError';

describe('JwksClient', () => {
  let client: JwksClient;
  let logger: ILogger;
  let cache: ICache<Jwk[]>;
  let httpClient: IHttpClient;

  const jwksUri = 'https://example.com/.well-known/jwks.json';
  const sampleJWKS = {
    keys: [
      {
        kid: 'key1',
        kty: 'RSA',
        n: 'sXch6vZ3N9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtQ9jYy5V9k7qJAsFDcQBUQM0E9sYbVjk40D19bXq9xLqGQ8GaPoVTVQeAUn0pFB1ZkWQQaTMeQFRt4ZtNTS7vkTl6T8tVQXoQoi8wS5fvAKX9uY4oVBcYecOgL',
        e: 'AQAB',
      },
      {
        kid: 'key2',
        kty: 'RSA',
        n: 'sXch6vZ3N9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtQ9jYy5V9k7qJAsFDcQBUQM0E9sYbVjk40D19bXq9xLqGQ8GaPoVTVQeAUn0pFB1ZkWQQaTMeQFRt4ZtNTS7vkTl6T8tVQXoQoi8wS5fvAKX9uY4oVBcYecOgL',
        e: 'AQAB',
      },
    ],
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Create fresh mock instances for each test
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      size: jest.fn(),
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

    // Default mock for httpClient.get to resolve with sampleJWKS
    (httpClient.get as jest.Mock).mockResolvedValue(JSON.stringify(sampleJWKS));

    client = new JwksClient(jwksUri, logger, httpClient, cache, 3600000);
  });

  describe('Constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(client).toBeInstanceOf(JwksClient);
      expect(logger).toBeDefined();
      expect(httpClient).toBeDefined();
      expect(cache).toBeDefined();
    });

    it('should throw ClientError if jwksUri is invalid', () => {
      expect(() => new JwksClient('', logger)).toThrowError(ClientError);
      expect(() => new JwksClient('', logger)).toThrow(
        'Invalid JWKS URI provided',
      );
    });

    it('should use default HTTPClient and cache if not provided', () => {
      const newClient = new JwksClient(jwksUri, logger);
      expect(newClient).toBeInstanceOf(JwksClient);
      // Further checks can be added to ensure defaults are used
    });
  });

  describe('getKey', () => {
    const kid = 'test-kid';
    const jwk: Jwk = { kid, kty: 'RSA', n: '...', e: 'AQAB' } as Jwk;
    const jwksResponse: JwksResponse = { keys: [jwk] };

    it('should throw ClientError if kid is not provided', async () => {
      await expect(client.getKey('')).rejects.toThrow(ClientError);
      await expect(client.getKey('')).rejects.toThrow('kid must be provided');
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should return key if found in cache', async () => {
      (cache.get as jest.Mock).mockReturnValue([jwk]);

      const result = await client.getKey(kid);
      expect(result).toBe(jwk);
      expect(cache.get).toHaveBeenCalledWith('jwks');
      expect(logger.debug).toHaveBeenCalledWith(`Cache hit for key: jwks`);
    });

    it('should fetch JWKS and update cache if cache is empty', async () => {
      (cache.get as jest.Mock)
        .mockReturnValueOnce(undefined) // Initial cache miss
        .mockReturnValueOnce(jwksResponse.keys); // After refresh

      (httpClient.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(jwksResponse),
      );

      const result = await client.getKey(kid);

      expect(cache.get).toHaveBeenCalledTimes(2);
      expect(cache.get).toHaveBeenNthCalledWith(1, 'jwks');
      expect(cache.get).toHaveBeenNthCalledWith(2, 'jwks');
      expect(logger.debug).toHaveBeenCalledWith('Fetching JWKS from URI', {
        jwksUri,
      });
      expect(httpClient.get).toHaveBeenCalledWith(jwksUri);
      expect(cache.set).toHaveBeenCalledWith(
        'jwks',
        jwksResponse.keys,
        3600000,
      );
      expect(logger.debug).toHaveBeenCalledWith('JWKS cache refreshed', {
        numberOfKeys: jwksResponse.keys.length,
      });
      expect(result).toBe(jwk);
    });

    it('should throw ClientError if JWKS fetch fails', async () => {
      (cache.get as jest.Mock).mockReturnValue(undefined);
      (httpClient.get as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      await expect(client.getKey(kid)).rejects.toMatchObject({
        message: 'Failed to fetch JWKS',
        code: 'JWKS_FETCH_ERROR',
      });
      expect(logger.error).toHaveBeenCalledWith('Failed to fetch JWKS', {
        error: expect.any(Error),
      });
    });

    it('should throw ClientError if JWKS cache is empty after refresh', async () => {
      // Simulate refreshCache fetching successfully but setting an empty keys array
      const emptyJwksResponse: JwksResponse = { keys: [] };

      // First call: Initial cache miss
      // Second call: After first refresh, returns empty array
      // Third call: After second refresh, still returns empty array
      (cache.get as jest.Mock)
        .mockReturnValueOnce(undefined) // Initial cache miss
        .mockReturnValueOnce(emptyJwksResponse.keys) // After first refresh
        .mockReturnValueOnce(emptyJwksResponse.keys); // After second refresh

      (httpClient.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(emptyJwksResponse),
      );

      await expect(client.getKey(kid)).rejects.toMatchObject({
        message: `No matching key found for kid ${kid}`,
        code: 'JWKS_KEY_NOT_FOUND',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        `Key with kid ${kid} not found. Refreshing JWKS.`,
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should throw ClientError if key not found after refresh', async () => {
      const missingJwksResponse: JwksResponse = { keys: [] };

      // First call: Initial cache miss
      // Second call: After first refresh, returns empty array
      // Third call: After second refresh, still returns empty array
      (cache.get as jest.Mock)
        .mockReturnValueOnce(undefined) // Initial cache miss
        .mockReturnValueOnce(missingJwksResponse.keys) // After first refresh
        .mockReturnValueOnce(missingJwksResponse.keys); // After second refresh

      (httpClient.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(missingJwksResponse),
      );

      await expect(client.getKey(kid)).rejects.toMatchObject({
        message: `No matching key found for kid ${kid}`,
        code: 'JWKS_KEY_NOT_FOUND',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        `Key with kid ${kid} not found. Refreshing JWKS.`,
      );
    });

    it('should handle concurrent getKey calls without multiple fetches', async () => {
      (cache.get as jest.Mock)
        .mockReturnValueOnce(undefined) // Initial cache miss
        .mockReturnValueOnce([jwk]) // After first refresh
        .mockReturnValueOnce([jwk]); // After second refresh for concurrent calls

      (httpClient.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(jwksResponse),
      );

      const promise1 = client.getKey(kid);
      const promise2 = client.getKey(kid);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(httpClient.get).toHaveBeenCalledTimes(1);
      expect(cache.get).toHaveBeenCalledTimes(3);
      expect(cache.get).toHaveBeenNthCalledWith(1, 'jwks');
      expect(cache.get).toHaveBeenNthCalledWith(2, 'jwks');
      expect(cache.get).toHaveBeenNthCalledWith(3, 'jwks');
      expect(result1).toBe(jwk);
      expect(result2).toBe(jwk);
    });
  });

  describe('refreshCache', () => {
    const jwk: Jwk = {
      kid: 'test-kid',
      kty: 'RSA',
      n: '...',
      e: 'AQAB',
    } as Jwk;
    const jwksResponse: JwksResponse = { keys: [jwk] };

    it('should fetch JWKS and update cache', async () => {
      (httpClient.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(jwksResponse),
      );

      await (client as any).refreshCache();

      expect(logger.debug).toHaveBeenCalledWith('Fetching JWKS from URI', {
        jwksUri,
      });
      expect(httpClient.get).toHaveBeenCalledWith(jwksUri);
      expect(cache.set).toHaveBeenCalledWith(
        'jwks',
        jwksResponse.keys,
        3600000,
      );
      expect(logger.debug).toHaveBeenCalledWith('JWKS cache refreshed', {
        numberOfKeys: jwksResponse.keys.length,
      });
    });

    it('should throw ClientError if HTTPClient.get fails', async () => {
      (httpClient.get as jest.Mock).mockRejectedValueOnce(
        new Error('Network failure'),
      );

      await expect((client as any).refreshCache()).rejects.toMatchObject({
        message: 'Failed to fetch JWKS',
        code: 'JWKS_FETCH_ERROR',
      });
      expect(logger.error).toHaveBeenCalledWith('Failed to fetch JWKS', {
        error: expect.any(Error),
      });
    });

    it('should throw ClientError if JWKS response is invalid JSON', async () => {
      (httpClient.get as jest.Mock).mockResolvedValueOnce('invalid-json');

      await expect((client as any).refreshCache()).rejects.toMatchObject({
        message: 'Invalid JWKS response format',
        code: 'JWKS_PARSE_ERROR',
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse JWKS response',
        { parseError: expect.any(Error) },
      );
    });

    it('should throw ClientError if JWKS response does not contain keys array', async () => {
      const invalidJwksResponse = { notKeys: [] };
      (httpClient.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(invalidJwksResponse),
      );

      await expect((client as any).refreshCache()).rejects.toMatchObject({
        message: 'JWKS response does not contain keys',
        code: 'JWKS_INVALID',
      });
      expect(logger.error).toHaveBeenCalledWith(
        'JWKS response does not contain keys array',
        { jwks: invalidJwksResponse },
      );
    });
  });
});
