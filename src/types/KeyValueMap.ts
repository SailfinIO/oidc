/**
 * @fileoverview
 * Defines the `KeyValueMap` type, a generic key-value mapping where both keys and values are strings.
 * This type can be used across various parts of the application for different categorization or mapping needs.
 *
 * @module src/types/KeyValueMap
 */

/**
 * Represents a generic key-value mapping where both keys and values are strings.
 *
 * The `KeyValueMap` type is versatile and can be used to define mappings for various purposes,
 * such as configuration settings, metadata, or any other scenario requiring key-value pairs.
 *
 * @typedef {KeyValueMap}
 * @type {Record<string, string>}
 *
 * @example
 * ```typescript
 * const config: KeyValueMap = {
 *   apiUrl: 'https://api.example.com',
 *   timeout: '5000',
 *   retryAttempts: '3',
 * };
 * ```
 */
export type KeyValueMap = Record<string, string>;
