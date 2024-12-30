import { RouteAction, Scopes } from '../enums';
import { IStoreContext } from './IStore';

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
  automaticRefresh?: boolean;
  requiresAuth?: boolean;
  requiredClaim?: {
    claimKey: string;
    claimValue?: any;
  };
  requiredScopes?: Scopes[];
}

/**
 * Route metadata that might be stored at the method level.
 */
export interface IRouteMetadata {
  requiresAuth?: boolean;
  onError?: (error: any, context: IStoreContext) => void;
  action?: RouteAction;
}
