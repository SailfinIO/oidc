import { Claims, RouteAction, Scopes } from '../enums';
import { IMutex } from './IMutex';
import { IRequest, IResponse } from './IStore';

/**
 * Metadata that might be stored at the class level.
 * Extend this interface as needed.
 */
export interface IClassMetadata {
  // Example: add properties if you want class-level metadata
  // e.g. isThisClassSpecial?: boolean;
}

/**
 * Metadata that might be stored at the method level.
 * The optional properties align with what the decorators might store.
 */
export interface IMethodMetadata {
  requiresAuth?: boolean;
  requiredClaims?: Claims[];
  isOidcCallback?: boolean;
  isOidcLogin?: boolean;
  isWithMutexLock?: boolean;
  mutex?: IMutex;
  timeout?: number;
}

/**
 * Route metadata that might be stored at the method level.
 */
export interface IRouteMetadata {
  requiresAuth?: boolean;
  onError?: (error: any, req: IRequest, res: IResponse) => void;
  action?: RouteAction;
  postLoginRedirectUri?: string;
  requiredClaims?: Claims[];
}
