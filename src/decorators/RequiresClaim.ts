// src/decorators/RequiresClaim.ts

/**
 * @fileoverview Decorator for marking a method as requiring a specific claim.
 */

import { MetadataManager } from './MetadataManager';

/**
 * Marks a method that requires the user to have a specific claim.
 * @param claimKey The claim key to check.
 * @param claimValue The claim value to check.
 * @returns {MethodDecorator} The method decorator.
 */
export const RequiresClaim = (
  claimKey: string,
  claimValue?: any,
): MethodDecorator => {
  return (target, propertyKey) => {
    MetadataManager.setMethodMetadata(
      target.constructor,
      typeof propertyKey === 'symbol' ? propertyKey.toString() : propertyKey,
      {
        requiredClaim: { claimKey, claimValue },
      },
    );
  };
};
