// src/session/InMemorySessionStore.ts

import { ISessionStore } from '../interfaces/ISessionStore';
import { ISessionData } from '../interfaces/ISessionData';
import { Logger } from '../utils/Logger';
import { randomUUID } from 'crypto';

export class InMemorySessionStore implements ISessionStore {
  private sessions: Map<string, ISessionData>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.sessions = new Map();
    this.logger = logger;
  }

  public createSession(data: ISessionData): string {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, data);
    this.logger.debug('Session created', { sessionId });
    return sessionId;
  }

  public getSession(sessionId: string): ISessionData | null {
    const session = this.sessions.get(sessionId) || null;
    this.logger.debug('Session retrieved', { sessionId, session });
    return session;
  }

  public deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.logger.debug('Session deleted', { sessionId });
  }
}
