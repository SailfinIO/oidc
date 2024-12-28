// src/decorators/RequiresAuthentication.ts

/**
 * @fileoverview Decorator for marking a method as requiring authentication.
 */

import { MetadataManager } from './MetadataManager';

/**
 * Marks a method that requires the user to be authenticated.
 */
export const RequiresAuthentication = (): MethodDecorator => {
  return (target, propertyKey) => {
    MetadataManager.setMethodMetadata(
      target.constructor,
      typeof propertyKey === 'symbol' ? propertyKey.toString() : propertyKey,
      {
        requiresAuth: true,
      },
    );
  };
};
