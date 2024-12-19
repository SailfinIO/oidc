// src/clients/DiscoveryClient.ts

import { IDiscoveryConfig } from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { Logger } from '../utils/Logger';
import { HTTPClient } from '../utils/HTTPClient';

export class DiscoveryClient {
  private readonly discoveryUrl: string;
  private readonly logger: Logger;
  private readonly httpClient: HTTPClient;
  private cachedConfig: IDiscoveryConfig | null = null;

  constructor(discoveryUrl: string, logger: Logger) {
    this.discoveryUrl = discoveryUrl;
    this.logger = logger;
    this.httpClient = new HTTPClient(this.logger);
  }

  public async fetchDiscoveryConfig(): Promise<IDiscoveryConfig> {
    if (this.cachedConfig) {
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
