// src/decorators/AutomaticRefresh.ts
/**
 * @fileoverview Decorator for automatically refreshing access token before calling a method.
 * @module decorators/AutomaticRefresh
 * @see module:decorators/MetadataManager
 */
import { MetadataManager } from './MetadataManager';

/**
 * Automatically refresh access token (if needed) before calling the method.
 * @returns {MethodDecorator} Method decorator.
 * @example
 * import { AutomaticRefresh } from './decorators/AutomaticRefresh';
 * class MyService {
 *  @AutomaticRefresh()
 * public async getData() {
 *  // Your code here
 * }
 * }
 */
export const AutomaticRefresh = (): MethodDecorator => {
  return (target, propertyKey) => {
    MetadataManager.setMethodMetadata(
      target.constructor,
      typeof propertyKey === 'symbol' ? propertyKey.toString() : propertyKey,
      { automaticRefresh: true },
    );
  };
};
