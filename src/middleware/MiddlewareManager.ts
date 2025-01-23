// src/middleware/MiddlewareManager.ts

import { NextFunction } from '../types';
import { Request } from '../classes';

export type Middleware = (req: Request, next: NextFunction) => Promise<void>;

export class MiddlewareManager {
  private _middlewares: Middleware[] = [];

  /**
   * Registers a middleware function.
   * @param middleware - The middleware function to register.
   */
  public use(middleware: Middleware): void {
    this._middlewares.push(middleware);
  }

  public get middlewares(): Middleware[] {
    return this._middlewares;
  }

  /**
   * Executes all registered middleware in sequence.
   * @param req - The Request instance to process.
   */
  public async execute(req: Request): Promise<void> {
    const { _middlewares } = this;

    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;
      const middleware = _middlewares[i];
      if (middleware) {
        await middleware(req, () => dispatch(i + 1));
      }
    };

    await dispatch(0);
  }
}
