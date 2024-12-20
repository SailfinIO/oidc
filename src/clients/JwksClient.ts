import { InMemoryCache } from '../cache/InMemoryCache';
import { ClientError } from '../errors/ClientError';
import { ILogger, IHttpClient, Jwk, JwksResponse, ICache } from '../interfaces';
import { HTTPClient } from './HTTPClient';

export class JwksClient {
  private fetchingJWKS: Promise<void> | null = null;
  private cacheKey: string = 'jwks';

  constructor(
    private jwksUri: string,
    private logger: ILogger,
    private httpClient: IHttpClient = new HTTPClient(logger),
    private cache: ICache<Jwk[]> = new InMemoryCache<Jwk[]>(logger),
    private cacheTtl: number = 3600000, // 1 hour default
  ) {
    this.validateJwksUri();
  }

  /**
   * Retrieves a JSON Web Key (JWK) by its Key ID (kid).
   * @param kid - The Key ID to search for.
   * @returns The corresponding JWK.
   * @throws ClientError if the kid is invalid or not found.
   */
  public async getKey(kid: string): Promise<Jwk> {
    if (!kid) {
      throw new ClientError('kid must be provided', 'INVALID_KID');
    }

    let jwks = this.cache.get(this.cacheKey);
    if (jwks) {
      this.logger.debug(`Cache hit for key: ${this.cacheKey}`);
    } else {
      await this.ensureJWKS();
      jwks = this.cache.get(this.cacheKey);
      if (!jwks) {
        throw new ClientError(
          'JWKS cache is empty after refresh',
          'JWKS_FETCH_ERROR',
        );
      }
    }

    let key = this.findKey(jwks, kid);
    if (!key) {
      this.logger.warn(`Key with kid ${kid} not found. Refreshing JWKS.`);
      await this.ensureJWKS();
      jwks = this.cache.get(this.cacheKey);
      key = this.findKey(jwks, kid);
      if (!key) {
        throw new ClientError(
          `No matching key found for kid ${kid}`,
          'JWKS_KEY_NOT_FOUND',
        );
      }
    }
    return key;
  }

  /**
   * Ensures that JWKS is fetched and cached. Prevents concurrent fetches.
   */
  private async ensureJWKS(): Promise<void> {
    if (!this.fetchingJWKS) {
      this.fetchingJWKS = this.refreshCache().finally(() => {
        this.fetchingJWKS = null;
      });
    }
    return this.fetchingJWKS;
  }

  /**
   * Finds a JWK by its Key ID within a JWKS array.
   * @param jwks - The array of JWKs.
   * @param kid - The Key ID to search for.
   * @returns The matching JWK or undefined if not found.
   */
  private findKey(jwks: Jwk[], kid: string): Jwk | undefined {
    return jwks.find((k) => k.kid === kid);
  }

  /**
   * Refreshes the JWKS cache by fetching from the JWKS URI.
   * @throws ClientError if fetching or parsing fails.
   */
  public async refreshCache(): Promise<void> {
    try {
      this.logger.debug('Fetching JWKS from URI', { jwksUri: this.jwksUri });
      const response = await this.httpClient.get(this.jwksUri);

      let jwks: JwksResponse;
      try {
        jwks = JSON.parse(response);
      } catch (parseError) {
        this.logger.error('Failed to parse JWKS response', { parseError });
        throw new ClientError(
          'Invalid JWKS response format',
          'JWKS_PARSE_ERROR',
        );
      }

      this.validateJwks(jwks);
      this.cache.set(this.cacheKey, jwks.keys, this.cacheTtl);
      this.logger.debug('JWKS cache refreshed', {
        numberOfKeys: jwks.keys.length,
      });
    } catch (error) {
      this.handleFetchError(error);
    }
  }

  /**
   * Validates the JWKS URI.
   * @throws ClientError if the JWKS URI is invalid.
   */
  private validateJwksUri(): void {
    if (!this.jwksUri || typeof this.jwksUri !== 'string') {
      throw new ClientError('Invalid JWKS URI provided', 'INVALID_JWKS_URI');
    }
  }

  /**
   * Validates the structure of the JWKS response.
   * @param jwks - The JWKS response to validate.
   * @throws ClientError if the JWKS structure is invalid.
   */
  private validateJwks(jwks: JwksResponse): void {
    if (!jwks.keys || !Array.isArray(jwks.keys)) {
      this.logger.error('JWKS response does not contain keys array', {
        jwks,
      });
      throw new ClientError(
        'JWKS response does not contain keys',
        'JWKS_INVALID',
      );
    }
  }

  /**
   * Handles errors that occur during JWKS fetching.
   * @param error - The error to handle.
   * @throws ClientError with appropriate messaging.
   */
  private handleFetchError(error: unknown): never {
    if (error instanceof ClientError) {
      throw error;
    }
    this.logger.error('Failed to fetch JWKS', { error });
    throw new ClientError('Failed to fetch JWKS', 'JWKS_FETCH_ERROR');
  }
}
