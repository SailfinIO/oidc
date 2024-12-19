// src/interfaces/ISessionStore.ts

import { ISessionData } from './ISessionData';

export interface ISessionStore {
  createSession(data: ISessionData): string;
  getSession(sessionId: string): ISessionData | null;
  deleteSession(sessionId: string): void;
}
