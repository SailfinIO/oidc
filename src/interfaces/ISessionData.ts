/**
 * @fileoverview
 * Defines the `ISessionData` interface, which represents the structure of session data
 * stored in a session management system. It includes information about cookies and optionally
 * user details.
 *
 * @module src/interfaces/ISessionData
 */

import { TokenSet } from './TokenSet';
import { IUser } from './IUser';

/**
 * Represents the data associated with a session.
 *
 * The `ISessionData` interface defines the structure for storing session-related
 * information, including token response details and optional user data.
 *
 * @interface
 */
export interface ISessionData {
  /**
   * Contains the token response details, such as access and refresh tokens.
   *
   * @type {TokenSet}
   */
  cookie?: TokenSet;

  /**
   * Optionally includes user information associated with the session.
   *
   * @type {IUser | undefined}
   */
  user?: IUser;

  /**
   * Contains the session state for CSRF protection.
   *
   * @type {string | undefined}
   */
  state?: string;

  /**
   * Contains the code verifier for PKCE.
   *
   * @type {string | undefined}
   */
  codeVerifier?: string;
}
