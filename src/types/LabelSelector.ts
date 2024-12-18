/**
 * Represents a key-value mapping for labels, where both keys and values are strings.
 * Commonly used to define selectors or mappings for resources.
 *
 * @typedef {Object} LabelSelector
 * @property {string} [key] - The key represents a label or identifier, and the value is its associated string value.
 *
 * @example
 * const mySelector: LabelSelector = {
 *  key: 'value',
 * };
 * };
 */
export type LabelSelector = { [key: string]: string };
