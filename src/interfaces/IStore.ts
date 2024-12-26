// src/interfaces/ISessionStore.ts

import { ISessionData } from './ISessionData';

export interface IStoreContext {
  request?: Request;
  response?: Response;
}

export interface IStore {
  set(data: ISessionData, context?: IStoreContext): Promise<string>;
  get(sid: string, context?: IStoreContext): Promise<ISessionData | null>;
  destroy(sid: string, context?: IStoreContext): Promise<void>;
  touch(
    sid: string,
    session: ISessionData,
    context?: IStoreContext,
  ): Promise<void>;
}
