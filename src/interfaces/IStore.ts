// src/interfaces/IStore.ts

import { ISessionData } from './ISessionData';

export interface IStoreContext {
  request?: Request;
  response?: Response;
}

export interface IStore {
  /**
   * Sets session data with the given session ID.
   * @param sid - The session ID.
   * @param data - The session data to store.
   * @param context - Optional store context.
   * @returns A promise that resolves when the data is set.
   */
  set(sid: string, data: ISessionData, context?: IStoreContext): Promise<void>;

  /**
   * Retrieves session data based on the session ID.
   * @param sid - The session ID.
   * @param context - Optional store context.
   * @returns A promise that resolves to the session data or null if not found.
   */
  get(sid: string, context?: IStoreContext): Promise<ISessionData | null>;

  /**
   * Destroys the session associated with the given session ID.
   * @param sid - The session ID.
   * @param context - Optional store context.
   * @returns A promise that resolves when the session is destroyed.
   */
  destroy(sid: string, context?: IStoreContext): Promise<void>;

  /**
   * Updates the session's expiration without altering the data.
   * @param sid - The session ID.
   * @param session - The current session data.
   * @param context - Optional store context.
   * @returns A promise that resolves when the session is touched.
   */
  touch(
    sid: string,
    session: ISessionData,
    context?: IStoreContext,
  ): Promise<void>;
}
