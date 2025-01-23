import { ProviderScopeOptions } from '../enums/ProviderScopeOptions';
import { Claims, RequestMethod, RouteAction } from '../enums';
import { IMutex } from './IMutex';
import { IRequest } from './IRequest';
import { IResponse } from './IResponse';

/**
 * Metadata that might be stored at the class level.
 * Extend this interface as needed.
 */
export interface IClassMetadata {
  injectable?: ProviderScopeOptions;
}
/**
 * Metadata that might be stored at the method level.
 * The optional properties align with what the decorators might store.
 */
export interface IMethodMetadata {
  inject?: any | any[];
  designType?: any;
  requiresAuth?: boolean;
  requiredClaims?: Claims[];
  isOidcCallback?: boolean;
  isOidcLogin?: boolean;
  isWithMutexLock?: boolean;
  mutex?: IMutex;
  timeout?: number;
  requiresRefresh?: boolean;
  route?: {
    method: RequestMethod;
  };
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
