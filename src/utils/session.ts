// src/utils/session.ts

import { IStore, ISessionData, IStoreContext } from '../interfaces';
import { parse } from './Cookie';

export function session(store: IStore) {
  return async (req: Request, res: Response, next: Function) => {
    const context: IStoreContext = { request: req, response: res };

    try {
      // Extract sid from cookies
      const cookieHeader = req.headers['cookie'];
      let sid: string | null = null;

      if (cookieHeader && typeof cookieHeader === 'string') {
        const cookies = parse(cookieHeader);
        sid = cookies['sid'] || null;
      }

      let sessionData: ISessionData | null = null;

      if (sid) {
        sessionData = await store.get(sid, context);
      }

      if (!sessionData) {
        // Initialize new session
        sessionData = { cookie: {}, passport: undefined };
        sid = await store.set(sessionData, context);
      }

      // Attach session data to the request object
      (req as any).session = sessionData;
      (req as any).sid = sid;

      // Update session data on response finish
      res.on('finish', async () => {
        if (sid && sessionData) {
          await store.touch(sid, sessionData, context);
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}
