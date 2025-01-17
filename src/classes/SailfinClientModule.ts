import { IClientConfig } from '../interfaces';
import { Client } from './Client';
import { SAILFIN_CLIENT } from '../constants/sailfinClientToken';
import { createSailfinClient } from '../utils';

export class SailfinClientModule {
  private static instances = new Map<symbol, Promise<Client>>();

  /**
   * Creates and registers an OIDC client instance.
   */
  static forRoot(config: Partial<IClientConfig>): {
    token: symbol;
    instance: Promise<Client>;
  } {
    const token = SAILFIN_CLIENT;
    const instance = createSailfinClient(config).useFactory();
    this.instances.set(token, instance);
    return { token, instance };
  }

  /**
   * Creates and registers an OIDC client instance asynchronously.
   */
  static async forRootAsync(
    configFactory: () => Promise<Partial<IClientConfig>>,
  ): Promise<{ token: symbol; instance: Promise<Client> }> {
    const token = SAILFIN_CLIENT;
    const config = await configFactory();
    const instance = createSailfinClient(config).useFactory();
    this.instances.set(token, instance);
    return { token, instance };
  }

  /**
   * Retrieves an OIDC client instance by its token.
   */
  static async getClient(token: symbol): Promise<Client> {
    const instance = this.instances.get(token);
    if (!instance) {
      throw new Error(`Client for token ${String(token)} not found.`);
    }
    return instance;
  }
}
