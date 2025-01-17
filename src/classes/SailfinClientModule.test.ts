import { SailfinClientModule } from './SailfinClientModule';
import { IClientConfig } from '../interfaces';
import { Client } from './Client';
import { SAILFIN_CLIENT } from '../constants/sailfinClientToken';
import { createSailfinClient } from '../utils';

jest.mock('../utils', () => ({
  createSailfinClient: jest.fn(),
}));

describe('SailfinClientModule', () => {
  const mockClient = {} as Client;
  const mockConfig: Partial<IClientConfig> = { clientId: 'test-client-id' };

  beforeEach(() => {
    (createSailfinClient as jest.Mock).mockReturnValue({
      useFactory: jest.fn().mockResolvedValue(mockClient),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('forRoot', () => {
    it('should create and register an OIDC client instance', async () => {
      const { token, instance } = SailfinClientModule.forRoot(mockConfig);

      expect(token).toBe(SAILFIN_CLIENT);
      expect(createSailfinClient).toHaveBeenCalledWith(mockConfig);
      expect(await instance).toBe(mockClient);
    });
  });

  describe('forRootAsync', () => {
    it('should create and register an OIDC client instance asynchronously', async () => {
      const mockConfigFactory = jest.fn().mockResolvedValue(mockConfig);
      const { token, instance } =
        await SailfinClientModule.forRootAsync(mockConfigFactory); // Await the method

      expect(token).toBe(SAILFIN_CLIENT);
      expect(mockConfigFactory).toHaveBeenCalled(); // Ensure factory was called
      expect(createSailfinClient).toHaveBeenCalledWith(mockConfig); // Ensure client creation was called with correct config
      expect(await instance).toBe(mockClient); // Await the client instance
    });
  });

  describe('getClient', () => {
    it('should retrieve an OIDC client instance by its token', async () => {
      SailfinClientModule.forRoot(mockConfig);
      const client = await SailfinClientModule.getClient(SAILFIN_CLIENT);

      expect(client).toBe(mockClient);
    });

    it('should throw an error if the client instance is not found', async () => {
      await expect(
        SailfinClientModule.getClient(Symbol('invalid-token')),
      ).rejects.toThrow('Client for token Symbol(invalid-token) not found.');
    });
  });
});
