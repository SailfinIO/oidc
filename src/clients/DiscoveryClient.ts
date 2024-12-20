// src/clients/DiscoveryClient.ts

import { IDiscoveryConfig } from '../interfaces';
import { ClientError } from '../errors';
import { Logger } from '../utils';
import { HTTPClient } from './HTTPClient';

export class DiscoveryClient {
  private readonly discoveryUrl: string;
  private readonly logger: Logger;
  private readonly httpClient: HTTPClient;
  private cachedConfig: IDiscoveryConfig | null = null;
  private cacheTTL: number; // Time to live in milliseconds
  private cacheTimestamp: number | null = null; // Timestamp of last fetch

  constructor(
    discoveryUrl: string,
    logger: Logger,
    cacheTTL: number = 3600000, // default 1 hour
  ) {
    this.discoveryUrl = discoveryUrl;
    this.logger = logger;
    this.httpClient = new HTTPClient(this.logger);
    this.cacheTTL = cacheTTL;
  }

  public async fetchDiscoveryConfig(
    forceRefresh: boolean = false,
  ): Promise<IDiscoveryConfig> {
    const now = Date.now();
    if (
      this.cachedConfig &&
      this.cacheTimestamp &&
      now - this.cacheTimestamp < this.cacheTTL &&
      !forceRefresh
    ) {
      return this.cachedConfig;
    }
    this.logger.debug('Fetching discovery document', {
      discoveryUrl: this.discoveryUrl,
    });
    try {
      const response = await this.httpClient.get(this.discoveryUrl);
      const config: IDiscoveryConfig = JSON.parse(response);
      this.logger.info('Successfully fetched discovery document');
      this.cachedConfig = config;
      this.cacheTimestamp = now;
      return config;
    } catch (error) {
      this.logger.error('Failed to fetch discovery document', error);
      throw new ClientError(
        'Unable to fetch discovery configuration',
        'DISCOVERY_ERROR',
        { originalError: error },
      );
    }
  }
}
