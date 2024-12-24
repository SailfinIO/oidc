// src/clients/Issuer.ts

import { IHttp, ICache, IIssuer, ILogger, ClientMetadata } from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { Http } from './Http';
import { InMemoryCache } from '../cache/InMemoryCache';

export class Issuer implements IIssuer {
  private readonly discoveryUrl: string;
  private readonly logger: ILogger;
  private readonly httpClient: IHttp;
  private readonly cache: ICache<ClientMetadata>;
  private readonly cacheKey: string = 'discoveryConfig';
  private readonly cacheTtl: number;
  private fetchingConfig: Promise<ClientMetadata> | null = null;

  constructor(
    discoveryUrl: string,
    logger: ILogger,
    httpClient?: IHttp,
    cache?: ICache<ClientMetadata>,
    cacheTtl: number = 3600000, // 1 hour default
  ) {
    if (!discoveryUrl || typeof discoveryUrl !== 'string') {
      throw new ClientError(
        'Invalid discovery URL provided',
        'INVALID_DISCOVERY_URL',
      );
    }

    this.discoveryUrl = discoveryUrl;
    this.logger = logger;
    this.httpClient = httpClient ?? new Http(this.logger);
    this.cache =
      cache ?? new InMemoryCache<ClientMetadata>(this.logger, cacheTtl);
    this.cacheTtl = cacheTtl;
  }

  /**
   * Retrieves the discovery configuration.
   * @param forceRefresh - If true, bypasses the cache and fetches fresh data.
   * @returns The discovery configuration.
   * @throws ClientError if fetching fails.
   */
  public async discoverClient(
    forceRefresh: boolean = false,
  ): Promise<ClientMetadata> {
    if (forceRefresh) {
      this.logger.debug('Force refresh enabled. Fetching discovery config.');
      return this.fetchAndCacheConfig();
    }

    const cachedConfig = this.cache.get(this.cacheKey);
    if (cachedConfig) {
      this.logger.debug('Cache hit for discovery config.');
      return cachedConfig;
    }

    this.logger.debug('Cache miss for discovery config.');
    return this.fetchAndCacheConfig();
  }

  /**
   * Ensures that only one fetch operation occurs at a time.
   * @returns The discovery configuration.
   */
  private async fetchAndCacheConfig(): Promise<ClientMetadata> {
    if (this.fetchingConfig !== null) {
      this.logger.debug(
        'Fetch in progress. Awaiting existing fetch operation.',
      );
      return this.fetchingConfig;
    }

    this.fetchingConfig = this.fetchDiscoveryMetadata().finally(() => {
      this.fetchingConfig = null;
    });

    return this.fetchingConfig;
  }

  /**
   * Fetches the discovery configuration from the discovery URL and caches it.
   * @returns The fetched discovery configuration.
   * @throws ClientError if fetching or parsing fails.
   */
  private async fetchDiscoveryMetadata(): Promise<ClientMetadata> {
    this.logger.debug('Fetching discovery configuration.', {
      discoveryUrl: this.discoveryUrl,
    });

    try {
      const response = await this.httpClient.get(this.discoveryUrl);
      const config: ClientMetadata = JSON.parse(response);
      this.validateDiscoveryMetadata(config);

      this.cache.set(this.cacheKey, config, this.cacheTtl);
      this.logger.info(
        'Discovery configuration fetched and cached successfully.',
      );
      return config;
    } catch (error) {
      this.logger.error('Failed to fetch discovery configuration.', { error });
      if (error instanceof ClientError) {
        throw error; // Rethrow existing ClientError without wrapping
      }
      throw new ClientError(
        'Unable to fetch discovery configuration',
        'DISCOVERY_ERROR',
        { originalError: error },
      );
    }
  }

  /**
   * Validates the structure of the discovery configuration.
   * @param config - The discovery configuration to validate.
   * @throws ClientError if the configuration is invalid.
   */
  private validateDiscoveryMetadata(client: ClientMetadata): void {
    const { issuer, jwks_uri, authorization_endpoint, token_endpoint } = client;

    if (!issuer || typeof issuer !== 'string') {
      throw new ClientError(
        'Invalid discovery configuration: Missing or invalid issuer.',
        'INVALID_DISCOVERY_CONFIG',
      );
    }

    if (!jwks_uri || typeof jwks_uri !== 'string') {
      throw new ClientError(
        'Invalid discovery configuration: Missing or invalid jwks_uri.',
        'INVALID_DISCOVERY_CONFIG',
      );
    }

    // Additional validations
    if (!authorization_endpoint || typeof authorization_endpoint !== 'string') {
      throw new ClientError(
        'Invalid discovery configuration: Missing or invalid authorization_endpoint.',
        'INVALID_DISCOVERY_CONFIG',
      );
    }

    if (!token_endpoint || typeof token_endpoint !== 'string') {
      throw new ClientError(
        'Invalid discovery configuration: Missing or invalid token_endpoint.',
        'INVALID_DISCOVERY_CONFIG',
      );
    }
  }
}
