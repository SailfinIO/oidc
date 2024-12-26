import { IStoreContext } from './IStore';

/**
 * Interface representing a Session for managing token lifecycle and refresh scheduling.
 */
export interface ISession {
  /**
   * Starts the session and schedules token refresh if enabled.
   *
   * This method checks the configuration for `useSilentRenew` and schedules
   * token refresh based on the token's expiration time.
   * @param context The store context containing the request and response.
   * @returns {Promise<void>} A promise that resolves when the session is started.
   */
  start(context: IStoreContext): Promise<void>;

  /**
   * Stops the session and clears any active token refresh timers.
   *
   * This method ensures that no further token refresh operations are scheduled.
   * @returns {void}
   */
  stop(): void;

  /**
   * The current session ID.
   *
   * Getter returns the session ID (if any).
   * Setter allows updating the session ID.
   */
  sid: string | null;
}
