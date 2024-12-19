// src/utils/Helpers.ts
import { URL, URLSearchParams } from 'url';
import { ClientError } from '../errors/ClientError';
import { AuthUrlParams } from '../interfaces/AuthUrlParams';
import { randomBytes, randomUUID } from 'crypto';

export class Helpers {
  /**
   * Builds a URL-encoded string from the given parameters.
   * @param params - An object containing key-value pairs to encode.
   * @returns {string} A URL-encoded string.
   */
  public static buildUrlEncodedBody(params: Record<string, string>): string {
    return Object.entries(params)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join('&');
  }

  /**
   * Builds an authorization URL using the given parameters.
   * @param params - An object containing authorization URL parameters.
   * @returns {string} The built authorization URL.
   */
  public static buildAuthorizationUrl(
    params: AuthUrlParams,
    additionalParams?: Record<string, string>,
  ): string {
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

      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          searchParams.append(key, value);
        });
      }

      url.search = searchParams.toString();
      return url.toString();
    } catch (error) {
      throw new ClientError(
        'Failed to build authorization URL',
        'URL_BUILD_ERROR',
        { originalError: error },
      );
    }
  }
}
