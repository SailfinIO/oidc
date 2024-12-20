// src/clients/DiscoveryClient.ts

import {
  IDiscoveryConfig,
  IHttpClient,
  ICache,
  IDiscoveryClient,
  ILogger,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { HTTPClient } from './HTTPClient';
import { InMemoryCache } from '../cache/InMemoryCache';

export class DiscoveryClient implements IDiscoveryClient {
  private readonly discoveryUrl: string;
  private readonly logger: ILogger;
  private readonly httpClient: IHttpClient;
  private readonly cache: ICache<IDiscoveryConfig>;
  private readonly cacheKey: string = 'discoveryConfig';
  private readonly cacheTtl: number;
  private fetchingConfig: Promise<IDiscoveryConfig> | null = null;

  constructor(
    discoveryUrl: string,
    logger: ILogger,
    httpClient?: IHttpClient,
    cache?: ICache<IDiscoveryConfig>,
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
    this.httpClient = httpClient ?? new HTTPClient(this.logger);
    this.cache =
      cache ?? new InMemoryCache<IDiscoveryConfig>(this.logger, cacheTtl);
    this.cacheTtl = cacheTtl;
  }

  /**
   * Retrieves the discovery configuration.
   * @param forceRefresh - If true, bypasses the cache and fetches fresh data.
   * @returns The discovery configuration.
   * @throws ClientError if fetching fails.
   */
  public async getDiscoveryConfig(
    forceRefresh: boolean = false,
  ): Promise<IDiscoveryConfig> {
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
  private async fetchAndCacheConfig(): Promise<IDiscoveryConfig> {
    if (this.fetchingConfig) {
      this.logger.debug(
        'Fetch in progress. Awaiting existing fetch operation.',
      );
      return this.fetchingConfig;
    }

    this.fetchingConfig = this.fetchDiscoveryConfig().finally(() => {
      this.fetchingConfig = null;
    });

    return this.fetchingConfig;
  }

  /**
   * Fetches the discovery configuration from the discovery URL and caches it.
   * @returns The fetched discovery configuration.
   * @throws ClientError if fetching or parsing fails.
   */
  private async fetchDiscoveryConfig(): Promise<IDiscoveryConfig> {
    this.logger.debug('Fetching discovery configuration.', {
      discoveryUrl: this.discoveryUrl,
    });

    try {
      const response = await this.httpClient.get(this.discoveryUrl);
      const config: IDiscoveryConfig = JSON.parse(response);
      this.validateDiscoveryConfig(config);

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
  private validateDiscoveryConfig(config: IDiscoveryConfig): void {
    if (!config.issuer || typeof config.issuer !== 'string') {
      throw new ClientError(
        'Invalid discovery configuration: Missing or invalid issuer.',
        'INVALID_DISCOVERY_CONFIG',
      );
    }

    if (!config.jwks_uri || typeof config.jwks_uri !== 'string') {
      throw new ClientError(
        'Invalid discovery configuration: Missing or invalid jwks_uri.',
        'INVALID_DISCOVERY_CONFIG',
      );
    }

    // Additional validations
    if (
      !config.authorization_endpoint ||
      typeof config.authorization_endpoint !== 'string'
    ) {
      throw new ClientError(
        'Invalid discovery configuration: Missing or invalid authorization_endpoint.',
        'INVALID_DISCOVERY_CONFIG',
      );
    }

    if (!config.token_endpoint || typeof config.token_endpoint !== 'string') {
      throw new ClientError(
        'Invalid discovery configuration: Missing or invalid token_endpoint.',
        'INVALID_DISCOVERY_CONFIG',
      );
    }
  }
}
