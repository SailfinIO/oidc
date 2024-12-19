// src/session/SessionManager.ts

import { Logger } from '../utils/Logger';
import { LogLevel } from '../enums';
import { Helpers } from '../utils/Helpers';

export class SessionManager {
  private sessions: Map<string, any>;
  private logger: Logger;

  constructor() {
    this.sessions = new Map();
    this.logger = new Logger('SessionManager', LogLevel.INFO, false);
  }

  /**
   * Creates a new session with the provided data.
   * @param data - The data to associate with the session.
   * @returns The generated session ID.
   */
  public createSession(data: any): string {
    const sessionId = Helpers.generateUUID();
    this.sessions.set(sessionId, data);
    this.logger.debug('Session created', { sessionId });
    return sessionId;
  }

  /**
   * Retrieves the session data associated with the given session ID.
   * @param sessionId - The ID of the session to retrieve.
   * @returns The session data, or null if not found.
   */
  public getSession(sessionId: string): any | null {
    const session = this.sessions.get(sessionId) || null;
    this.logger.debug('Session retrieved', { sessionId, session });
    return session;
  }

  /**
   * Deletes the session associated with the given session ID.
   * @param sessionId - The ID of the session to delete.
   */
  public deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.logger.debug('Session deleted', { sessionId });
  }
}
