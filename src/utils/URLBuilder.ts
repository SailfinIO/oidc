import { URL, URLSearchParams } from 'url';
import { ClientError } from '../errors/ClientError';

interface AuthUrlParams {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export class URLBuilder {
  public static buildAuthorizationUrl(params: AuthUrlParams): string {
    try {
      const url = new URL(params.authorizationEndpoint);
      const searchParams = new URLSearchParams({
        response_type: params.responseType,
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        scope: params.scope,
        state: params.state,
      });

      if (params.codeChallenge) {
        searchParams.append('code_challenge', params.codeChallenge);
        searchParams.append(
          'code_challenge_method',
          params.codeChallengeMethod || 'S256',
        );
      }

      url.search = searchParams.toString();
      return url.toString();
    } catch (error) {
      throw new ClientError(
        'Failed to build authorization URL',
        'URL_BUILD_ERROR',
      );
    }
  }
}
