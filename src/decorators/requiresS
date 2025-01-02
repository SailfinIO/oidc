/**
 * @fileoverview RequiresScopes decorator.
 */
import { Scopes } from '../enums';
import { MetadataManager } from './MetadataManager';

/**
 * Ensures the user’s token or session has specific scopes.
 * @param requiredScopes The scopes required to access the method.
 * @returns {MethodDecorator} The method decorator.
 */
export const RequiresScopes = (
  ...requiredScopes: Scopes[]
): MethodDecorator => {
  return (target, propertyKey) => {
    MetadataManager.setMethodMetadata(
      target.constructor,
      typeof propertyKey === 'symbol' ? propertyKey.toString() : propertyKey,
      {
        requiredScopes,
      },
    );
  };
};
