// src/interfaces/IToken.ts

import { ITokenResponse } from './ITokenResponse';
import { ITokenIntrospectionResponse } from './ITokenIntrospectionResponse';
import { TokenTypeHint } from '../enums/TokenTypeHint';

export interface IToken {
  /**
   * Sets the tokens based on the token response.
   * @param tokenResponse The response containing tokens.
   */
  setTokens(tokenResponse: ITokenResponse): void;

  /**
   * Retrieves the current access token, refreshing it if necessary.
   * @returns A promise that resolves to the access token or null.
   */
  getAccessToken(): Promise<string | null>;

  /**
   * Refreshes the access token using the refresh token.
   */
  refreshAccessToken(): Promise<void>;

  /**
   * Retrieves the current token response.
   * @returns The token response or null if no tokens are set.
   */
  getTokens(): ITokenResponse | null;

  /**
   * Clears all stored tokens.
   */
  clearTokens(): void;

  /**
   * Introspects a given token.
   * @param token The token to introspect.
   * @returns A promise that resolves to the introspection response.
   */
  introspectToken(token: string): Promise<ITokenIntrospectionResponse>;

  /**
   * Revokes a given token.
   * @param token The token to revoke.
   * @param tokenTypeHint Optional hint about the type of token.
   */
  revokeToken(token: string, tokenTypeHint?: TokenTypeHint): Promise<void>;
}
