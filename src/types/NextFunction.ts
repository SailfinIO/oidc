// src/types/NextFunction.ts

/**
 * NextFunction type definition.
 * @typedef {() => Promise<void>} NextFunction
 * @returns {Promise<void>} A promise that resolves when the function completes.
 * @example
 * const next: NextFunction = async () => {
 *  // Do something
 * };
 */
export type NextFunction = () => Promise<void>;
