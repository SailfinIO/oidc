/**
 * @fileoverview
 * Utility functions for handling URL operations, including building URL-encoded
 * bodies, constructing authorization URLs, and encoding/decoding Base64URL strings.
 * This module facilitates the creation and manipulation of URLs, particularly in
 * authentication and authorization workflows.
 *
 * @module src/utils/urlUtils
 */

import { URL, URLSearchParams } from 'url';
import { ClientError } from '../errors/ClientError';
import { AuthUrlParams } from '../interfaces/AuthUrlParams';
import { Algorithm, BinaryToTextEncoding } from '../enums';

/**
 * Builds a URL-encoded string from the given key-value parameters.
 *
 * This function takes an object containing key-value pairs and converts it into
 * a URL-encoded string suitable for use in HTTP request bodies or query strings.
 *
 * @param {Record<string, string>} params - An object containing key-value pairs to encode.
 * @returns {string} A URL-encoded string representing the input parameters.
 *
 * @example
 * ```typescript
 * const params = { username: 'john_doe', password: 'securePassword123' };
 * const encodedBody = buildUrlEncodedBody(params);
 * console.log(encodedBody); // Outputs: "username=john_doe&password=securePassword123"
 * ```
 */
export const buildUrlEncodedBody = (params: Record<string, string>): string => {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
};

/**
 * Builds an authorization URL using the provided parameters.
 *
 * This function constructs a complete authorization URL by appending the necessary
 * query parameters to the specified authorization endpoint. It supports additional
 * parameters and handles code challenge methods for PKCE (Proof Key for Code Exchange)
 * when provided.
 *
 * @param {AuthUrlParams} params - An object containing authorization URL parameters.
 * @param {Record<string, string>} [additionalParams] - Optional additional query parameters to include in the URL.
 * @returns {string} The fully constructed authorization URL.
 *
 * @throws {ClientError} If building the URL fails due to invalid parameters or URL construction issues.
 *
 * @example
 * ```typescript
 * const authParams: AuthUrlParams = {
 *   authorizationEndpoint: 'https://auth.example.com/authorize',
 *   responseType: 'code',
 *   clientId: 'your-client-id',
 *   redirectUri: 'https://yourapp.com/callback',
 *   scope: 'openid profile email',
 *   state: 'randomStateString',
 *   codeChallenge: 'generatedCodeChallenge',
 *   codeChallengeMethod: Algorithm.SHA256,
 * };
 * const authUrl = buildAuthorizationUrl(authParams);
 * console.log(authUrl);
 * // Outputs a URL like:
 * // "https://auth.example.com/authorize?response_type=code&client_id=your-client-id&redirect_uri=https%3A%2F%2Fyourapp.com%2Fcallback&scope=openid%20profile%20email&state=randomStateString&code_challenge=generatedCodeChallenge&code_challenge_method=S256"
 * ```
 */
export const buildAuthorizationUrl = (
  params: AuthUrlParams,
  additionalParams?: Record<string, string>,
): string => {
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
        params.codeChallengeMethod || Algorithm.SHA256,
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
};

/**
 * Encodes a buffer to a Base64URL string.
 *
 * This function converts binary data into a Base64URL-encoded string, which is
 * safe for inclusion in URLs and HTTP headers. It replaces characters as per
 * the Base64URL specification and removes padding characters.
 *
 * @param {Buffer} input - The buffer containing binary data to encode.
 * @returns {string} The Base64URL-encoded string.
 *
 * @example
 * ```typescript
 * const input = Buffer.from('Hello World');
 * const encoded = base64UrlEncode(input);
 * console.log(encoded); // Outputs: "SGVsbG8gV29ybGQ"
 * ```
 */
export const base64UrlEncode = (input: Buffer): string => {
  return input
    .toString(BinaryToTextEncoding.BASE_64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Decodes a Base64URL string to a buffer.
 *
 * This function converts a Base64URL-encoded string back into its original binary form.
 * It restores the necessary padding and replaces URL-safe characters with their
 * Base64 counterparts before decoding.
 *
 * @param {string} input - The Base64URL-encoded string to decode.
 * @returns {Buffer} A buffer containing the decoded binary data.
 *
 * @example
 * ```typescript
 * const input = 'SGVsbG8gV29ybGQ';
 * const decoded = base64UrlDecode(input);
 * console.log(decoded.toString()); // Outputs: "Hello World"
 * ```
 */
export const base64UrlDecode = (input: string): Buffer => {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4 !== 0) {
    input += '=';
  }
  return Buffer.from(input, BinaryToTextEncoding.BASE_64);
};
