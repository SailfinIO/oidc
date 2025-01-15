// src/decorators/WithSession.ts

import { MetadataManager } from './MetadataManager';
import { IMethodMetadata, IRouteMetadata } from '../interfaces';
import { Claims, RequestMethod, RouteAction } from '../enums';

/**
 * Decorator to mark a route as requiring an authenticated session.
 * @param httpMethod - The HTTP method for the route (default: GET).
 * @param requiredClaims - An optional array of required claims.
 */
export const Protected = (
  httpMethod: RequestMethod = RequestMethod.GET,
  requiredClaims?: Claims[],
): MethodDecorator => {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    // Attach metadata indicating this route requires authentication
    MetadataManager.setMethodMetadata(
      target.constructor,
      propertyKey as string,
      {
        requiresAuth: true,
        requiredClaims: requiredClaims,
      } as IMethodMetadata,
    );

    // Set route metadata including the HTTP method and RouteAction
    MetadataManager.setRouteMetadata(
      httpMethod,
      `/${propertyKey.toString()}`, // This is a placeholder; ideally use the actual route path
      {
        requiresAuth: true,
        requiredClaims: requiredClaims,
        action: RouteAction.Protected,
      } as IRouteMetadata,
    );

    return descriptor;
  };
};
