// src/interfaces/IDiscoveryClient.ts

import { IDiscoveryConfig } from './IDiscoveryConfig';

/**
 * Interface for DiscoveryClient.
 * Defines the contract for fetching and managing discovery configurations.
 */
export interface IDiscoveryClient {
  /**
   * Retrieves the discovery configuration from the discovery URL.
   * Utilizes caching to minimize redundant network requests.
   *
   * @param forceRefresh - If true, bypasses the cache and fetches fresh data.
   * @returns A promise that resolves to the discovery configuration.
   * @throws ClientError if fetching or parsing the configuration fails.
   */
  getDiscoveryConfig(forceRefresh?: boolean): Promise<IDiscoveryConfig>;
}
