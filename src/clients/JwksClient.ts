import { ClientError } from '../errors/ClientError';
import { ILogger, Jwk, JwksResponse } from '../interfaces';
import { HTTPClient } from './HTTPClient';

export class JwksClient {
  private jwksUri: string;
  private logger: ILogger;
  private httpClient: HTTPClient;
  private cache: Jwk[] | null = null;

  constructor(jwksUri: string, logger: ILogger) {
    this.jwksUri = jwksUri;
    this.logger = logger;
    this.httpClient = new HTTPClient(this.logger);
  }

  public async getKey(kid: string): Promise<Jwk> {
    if (!this.cache) {
      this.logger.debug('Fetching JWKS');
      const response = await this.httpClient.get(this.jwksUri);
      const jwks: JwksResponse = JSON.parse(response);
      this.cache = jwks.keys;
    }

    const key = this.cache.find((k) => k.kid === kid);
    if (!key) {
      throw new ClientError(
        `No matching key found for kid ${kid}`,
        'JWKS_KEY_NOT_FOUND',
      );
    }
    return key;
  }
}
