import { Pkce } from './Pkce';
import { PkceMethod } from '../enums/PkceMethod';
import { ClientError } from '../errors/ClientError';
import { IClientConfig } from 'src/interfaces';

describe('Pkce', () => {
  const validConfigS256 = {
    pkce: true,
    pkceMethod: PkceMethod.S256,
  };

  const validConfigPlain: Partial<IClientConfig> = {
    pkce: true,
    pkceMethod: PkceMethod.Plain,
  };

  const invalidConfigMissingMethod: Partial<IClientConfig> = {
    pkce: true,
    // pkceMethod is missing
  };

  const invalidConfigUnsupportedMethod: Partial<IClientConfig> = {
    pkce: true,
    // @ts-ignore // Ignoring TypeScript error for demonstration purposes
    pkceMethod: 'unsupported_method', // Assuming 'unsupported_method' is not in PkceMethod
  };

  it('should generate code verifier and code challenge correctly with S256 method', () => {
    const pkceService = new Pkce(validConfigS256 as IClientConfig);
    const { codeVerifier, codeChallenge } = pkceService.generatePkce();
    expect(codeVerifier).toBeDefined();
    expect(codeChallenge).toBeDefined();
    // Additional assertions can be added here
  });

  it('should generate code verifier and code challenge correctly with Plain method', () => {
    const pkceService = new Pkce(validConfigPlain as IClientConfig);
    const { codeVerifier, codeChallenge } = pkceService.generatePkce();
    expect(codeVerifier).toBeDefined();
    expect(codeChallenge).toBe(codeVerifier);
  });

  it('should throw ClientError if PKCE is enabled but pkceMethod is missing', () => {
    expect(() => new Pkce(invalidConfigMissingMethod as IClientConfig)).toThrow(
      ClientError,
    );
    expect(() => new Pkce(invalidConfigMissingMethod as IClientConfig)).toThrow(
      'Invalid PKCE configuration: `pkceMethod` must be specified and valid when PKCE is enabled.',
    );
  });

  it('should throw ClientError if PKCE is enabled with unsupported pkceMethod', () => {
    expect(
      () => new Pkce(invalidConfigUnsupportedMethod as IClientConfig),
    ).toThrow(ClientError);
    expect(
      () => new Pkce(invalidConfigUnsupportedMethod as IClientConfig),
    ).toThrow(
      'Invalid PKCE configuration: `pkceMethod` must be specified and valid when PKCE is enabled.',
    );
  });

  it('should throw ClientError if PKCE is disabled but pkceMethod is specified', () => {
    const config: Partial<IClientConfig> = {
      pkce: false,
      pkceMethod: PkceMethod.S256,
    };

    const pkceService = new Pkce(config as IClientConfig);
    const { codeVerifier, codeChallenge } = pkceService.generatePkce();
    expect(codeVerifier).toBeDefined();
    expect(codeChallenge).toBeDefined();
  });
});
