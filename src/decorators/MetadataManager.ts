// src/decorators/MetadataManager.ts

/**
 * @fileoverview Manages class-level and method-level metadata using an in-memory Cache.
 * @module decorators/MetadataManager
 * @see module:cache/Cache
 * @see module:decorators/KeyFactory
 */
import {
  IClassMetadata,
  IMethodMetadata,
  ICache,
  IRouteMetadata,
} from '../interfaces';
import { Cache } from '../cache/Cache';
import { KeyFactory } from './KeyFactory';
import { ILogger } from '../interfaces'; // Your logger interface

/**
 * Manages class-level and method-level metadata using an in-memory Cache.
 */
export class MetadataManager {
  /**
   * We store class-level metadata in a Cache keyed by "class:<someKey>".
   */
  private static classMetadataCache: ICache<IClassMetadata> | null = null;
  /**
   * We store method-level metadata in a Cache keyed by "method:<someKey>:<methodName>".
   */
  private static methodMetadataCache: ICache<IMethodMetadata> | null = null;

  /**
   * We could store route-level metadata in a Cache keyed by "route:<someKey>:<methodName>".
   */
  private static routeMetadataCache: ICache<IRouteMetadata> | null = null;

  /**
   * Initialize (or inject) the caches.
   * You can do this once at app startup or make them lazy-initialized.
   * @param {ILogger} logger - Your logger implementation.
   */
  public static init(logger: ILogger) {
    this.classMetadataCache = new Cache<IClassMetadata>(logger);
    this.methodMetadataCache = new Cache<IMethodMetadata>(logger);
    this.routeMetadataCache = new Cache<IRouteMetadata>(logger);
  }

  /**
   * Attach (merge) metadata to a class (constructor function).
   * @param {Function} target - The constructor function.
   * @param {Partial<IClassMetadata>} metadata - The metadata to attach.
   * @throws {TypeError} If target is not a constructor function.
   * @throws {Error} If caches have not been initialized.
   * @returns {void}
   */
  public static setClassMetadata(
    target: Function,
    metadata: Partial<IClassMetadata>,
  ): void {
    if (typeof target !== 'function') {
      throw new TypeError(
        'setClassMetadata expects a constructor function as the target.',
      );
    }
    if (!this.classMetadataCache) {
      throw new Error(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    }
    const ctorKey = KeyFactory.getKeyForFunction(target);
    const cacheKey = `class:${ctorKey}`;
    const existing = this.classMetadataCache.get(cacheKey) || {};
    const merged = { ...existing, ...metadata };
    this.classMetadataCache.set(cacheKey, merged);
  }

  /**
   * Retrieve metadata attached to a class constructor.
   * @param {Function} target - The constructor function.
   * @throws {TypeError} If target is not a constructor function.
   * @throws {Error} If caches have not been initialized.
   * @returns {IClassMetadata | undefined} The metadata attached to the class.
   */
  public static getClassMetadata(target: Function): IClassMetadata | undefined {
    if (typeof target !== 'function') {
      throw new TypeError(
        'getClassMetadata expects a constructor function as the target.',
      );
    }
    if (!this.classMetadataCache) {
      throw new Error(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    }
    const ctorKey = KeyFactory.getKeyForFunction(target);
    const cacheKey = `class:${ctorKey}`;
    return this.classMetadataCache.get(cacheKey);
  }

  /**
   * Attach (merge) metadata to a method (by property name).
   * @param {Function} targetConstructor - The constructor function.
   * @param {string} propertyKey - The method name.
   * @param {Partial<IMethodMetadata>} metadata - The metadata to attach.
   * @throws {TypeError} If targetConstructor is not a constructor function.
   * @throws {TypeError} If propertyKey is not a string.
   * @throws {Error} If caches have not been initialized.
   * @returns {void}
   */
  public static setMethodMetadata(
    targetConstructor: Function,
    propertyKey: string,
    metadata: Partial<IMethodMetadata>,
  ): void {
    if (typeof targetConstructor !== 'function') {
      throw new TypeError(
        'setMethodMetadata expects a constructor function as the targetConstructor.',
      );
    }
    if (typeof propertyKey !== 'string') {
      throw new TypeError(
        'setMethodMetadata expects a string as the propertyKey.',
      );
    }
    if (!this.methodMetadataCache) {
      throw new Error(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    }
    const ctorKey = KeyFactory.getKeyForFunction(targetConstructor);
    const cacheKey = `method:${ctorKey}:${propertyKey}`;
    const existing = this.methodMetadataCache.get(cacheKey) || {};
    const merged = { ...existing, ...metadata };
    this.methodMetadataCache.set(cacheKey, merged);
  }

  /**
   * Retrieve metadata attached to a specific method on a class constructor.
   * @param {Function} targetConstructor - The constructor function.
   * @param {string} propertyKey - The method name.
   * @throws {TypeError} If targetConstructor is not a constructor function.
   * @throws {TypeError} If propertyKey is not a string.
   * @throws {Error} If caches have not been initialized.
   * @returns {IMethodMetadata | undefined} The metadata attached to the method.
   */
  public static getMethodMetadata(
    targetConstructor: Function,
    propertyKey: string,
  ): IMethodMetadata | undefined {
    if (typeof targetConstructor !== 'function') {
      throw new TypeError(
        'getMethodMetadata expects a constructor function as the targetConstructor.',
      );
    }
    if (typeof propertyKey !== 'string') {
      throw new TypeError(
        'getMethodMetadata expects a string as the propertyKey.',
      );
    }
    if (!this.methodMetadataCache) {
      throw new Error(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    }
    const ctorKey = KeyFactory.getKeyForFunction(targetConstructor);
    const cacheKey = `method:${ctorKey}:${propertyKey}`;
    return this.methodMetadataCache.get(cacheKey);
  }

  /**
   * Sets metadata for a specific route.
   * @param method HTTP method (e.g., 'GET', 'POST').
   * @param path Route path (e.g., '/login').
   * @param metadata Metadata to attach.
   */
  public static setRouteMetadata(
    method: string,
    path: string,
    metadata: IRouteMetadata,
  ): void {
    if (!this.routeMetadataCache) {
      throw new Error(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    }
    const cacheKey = `route:${method.toUpperCase()}:${path}`;
    const existing = this.routeMetadataCache.get(cacheKey) || {};
    const merged = { ...existing, ...metadata };
    this.routeMetadataCache.set(cacheKey, merged);
  }

  /**
   * Retrieves metadata for a specific route.
   * @param method HTTP method.
   * @param path Route path.
   * @returns Metadata attached to the route.
   */
  public static getRouteMetadata(
    method: string,
    path: string,
  ): IRouteMetadata | undefined {
    if (!this.routeMetadataCache) {
      throw new Error(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    }
    const cacheKey = `route:${method.toUpperCase()}:${path}`;
    return this.routeMetadataCache.get(cacheKey);
  }

  /**
   * For testing: Clear all metadata from both class-level and method-level caches.
   * @throws {Error} If caches have not been initialized.
   * @returns {void}
   */
  public static reset(): void {
    if (this.classMetadataCache && this.methodMetadataCache) {
      this.classMetadataCache.clear();
      this.methodMetadataCache.clear();
      this.routeMetadataCache.clear();
    } else {
      throw new Error(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    }
  }
}
