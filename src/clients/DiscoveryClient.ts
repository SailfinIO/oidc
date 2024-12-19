// src/clients/DiscoveryClient.ts

import { IDiscoveryConfig } from '../interfaces';
import { ClientError } from '../errors/ClientError';
import { HTTPClient } from '../utils/HTTPClient';
import { Logger } from '../utils/Logger';

export class DiscoveryClient {
  private discoveryUrl: string;
  private logger: Logger;

  constructor(discoveryUrl: string, logger: Logger) {
    this.discoveryUrl = discoveryUrl;
    this.logger = logger;
  }

  public async fetchDiscoveryConfig(): Promise<IDiscoveryConfig> {
    this.logger.debug('Fetching discovery document', {
      discoveryUrl: this.discoveryUrl,
    });
    try {
      const response = await HTTPClient.get(this.discoveryUrl);
      const config: IDiscoveryConfig = JSON.parse(response);
      this.logger.info('Successfully fetched discovery document');
      return config;
    } catch (error) {
      this.logger.error('Failed to fetch discovery document', error);
      throw new ClientError(
        'Unable to fetch discovery configuration',
        'DISCOVERY_ERROR',
      );
    }
  }
}
