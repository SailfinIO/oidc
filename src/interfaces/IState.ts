/**
 * @fileoverview
 * Interface for managing OAuth2/OIDC state-nonce mappings.
 * Provides methods for securely adding, retrieving, and deleting state-nonce pairs.
 *
 * @module src/interfaces/IState
 */

/**
 * Interface for managing state-nonce pairs in OAuth2/OIDC flows.
 *
 * The `IState` interface defines methods for adding and retrieving state-nonce pairs,
 * ensuring that states are unique and valid during authentication flows. Implementations
 * must ensure thread-safety and prevent race conditions.
 */
export interface IState {
  /**
   * Adds a state-nonce pair to the manager.
   *
   * This method securely stores a unique state and its associated nonce, ensuring
   * that the state does not already exist. It must throw an error if the state
   * already exists to prevent collisions.
   *
   * @param {string} state - The unique state string.
   * @param {string} nonce - The nonce associated with the state.
   * @throws {Error} If the state already exists.
   * @returns {Promise<void>} Resolves when the state-nonce pair has been added successfully.
   *
   * @example
   * ```typescript
   * await stateManager.addState('state123', 'nonce456');
   * ```
   */
  addState(state: string, nonce: string): Promise<void>;

  /**
   * Retrieves and deletes the nonce associated with a state.
   *
   * This method looks up the nonce associated with a given state and removes
   * the state from storage. It ensures that the state is valid and has not been
   * previously retrieved.
   *
   * @param {string} state - The state string to look up.
   * @throws {Error} If the state is not found or does not match.
   * @returns {Promise<string>} Resolves with the associated nonce.
   *
   * @example
   * ```typescript
   * const nonce = await stateManager.getNonce('state123'); // 'nonce456'
   * ```
   */
  getNonce(state: string): Promise<string>;
}
