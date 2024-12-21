/**
 * @fileoverview
 * Defines the `LabelSelector` type, a key-value mapping where both keys and values are strings.
 * This type is commonly used for resource selection or categorization in systems like Kubernetes.
 *
 * @module src/types/LabelSelector
 */

/**
 * Represents a key-value mapping for labels, where both keys and values are strings.
 *
 * The `LabelSelector` type is commonly used to define selectors or mappings for resources,
 * such as filtering or categorizing entities based on labels.
 *
 * @typedef {LabelSelector}
 * @type {Record<string, string>}
 *
 * @example
 * ```typescript
 * const mySelector: LabelSelector = {
 *   environment: 'production',
 *   app: 'my-service',
 *   version: '1.0.0',
 * };
 * ```
 */
export type LabelSelector = { [key: string]: string };
