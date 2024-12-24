/**
 * @fileoverview
 * Test suite for the `State` service class.
 * This suite verifies the correct handling of state-nonce mappings, ensuring
 * thread-safe operations and proper error handling for invalid scenarios.
 *
 * @module src/classes/State.test
 */

import { State } from './State';
import { ClientError } from '../errors/ClientError';
import { IState } from '../interfaces';

describe('State', () => {
  let stateManager: IState;

  beforeEach(() => {
    stateManager = new State();
  });

  it('should add a state-nonce pair and retrieve the nonce', async () => {
    const state = 'state123';
    const nonce = 'nonce456';

    await stateManager.addState(state, nonce);
    const retrievedNonce = await stateManager.getNonce(state);

    expect(retrievedNonce).toBe(nonce);
  });

  it('should throw ClientError if adding a duplicate state', async () => {
    const state = 'state123';
    const nonce = 'nonce456';

    await stateManager.addState(state, nonce);

    await expect(stateManager.addState(state, 'nonce789')).rejects.toThrow(
      ClientError,
    );
    await expect(stateManager.addState(state, 'nonce789')).rejects.toThrowError(
      new ClientError(
        `State "${state}" already exists`,
        'STATE_ALREADY_EXISTS',
      ),
    );
  });

  it('should throw ClientError if retrieving a nonce for a nonexistent state', async () => {
    const state = 'nonexistent-state';

    await expect(stateManager.getNonce(state)).rejects.toThrow(ClientError);
    await expect(stateManager.getNonce(state)).rejects.toThrowError(
      new ClientError(
        `State "${state}" does not match or was not found`,
        'STATE_MISMATCH',
      ),
    );
  });

  it('should throw ClientError if retrieving a nonce for a deleted state', async () => {
    const state = 'state123';
    const nonce = 'nonce456';

    await stateManager.addState(state, nonce);
    await stateManager.getNonce(state); // This deletes the state

    await expect(stateManager.getNonce(state)).rejects.toThrow(ClientError);
    await expect(stateManager.getNonce(state)).rejects.toThrowError(
      new ClientError(
        `State "${state}" does not match or was not found`,
        'STATE_MISMATCH',
      ),
    );
  });

  it('should handle multiple states independently', async () => {
    const state1 = 'state1';
    const nonce1 = 'nonce1';
    const state2 = 'state2';
    const nonce2 = 'nonce2';

    await stateManager.addState(state1, nonce1);
    await stateManager.addState(state2, nonce2);

    const retrievedNonce1 = await stateManager.getNonce(state1);
    const retrievedNonce2 = await stateManager.getNonce(state2);

    expect(retrievedNonce1).toBe(nonce1);
    expect(retrievedNonce2).toBe(nonce2);
  });

  it('should be thread-safe for concurrent operations', async () => {
    const state1 = 'state1';
    const nonce1 = 'nonce1';
    const state2 = 'state2';
    const nonce2 = 'nonce2';

    const addState1 = stateManager.addState(state1, nonce1);
    const addState2 = stateManager.addState(state2, nonce2);

    await Promise.all([addState1, addState2]);

    const retrievedNonce1 = await stateManager.getNonce(state1);
    const retrievedNonce2 = await stateManager.getNonce(state2);

    expect(retrievedNonce1).toBe(nonce1);
    expect(retrievedNonce2).toBe(nonce2);
  });
});
