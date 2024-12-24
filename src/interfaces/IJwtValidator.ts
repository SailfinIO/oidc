/**
 * @fileoverview
 * Defines the `IJwtValidator` interface for validating JSON Web Tokens (JWTs).
 * This interface provides a contract for implementing JWT validation logic,
 * including signature verification and claims validation.
 *
 * @module src/interfaces/IJwtValidator
 */

import { JwtPayload } from './Jwt';

/**
 * Defines the `IJwtValidator` interface for validating JWTs.
 *
 * The `IJwtValidator` interface provides methods for validating the integrity
 * and authenticity of JWTs by verifying their signatures and validating their
 * claims. Implementations of this interface ensure that a JWT meets the necessary
 * security and compliance requirements before it is accepted by the application.
 */
export interface IJwtValidator {
  /**
   * Validates an ID Token (JWT) by verifying its signature and claims.
   *
   * This method performs the following validation steps:
   * - Decodes the JWT and extracts its header and payload.
   * - Validates the claims in the payload (e.g., issuer, audience, expiration, nonce).
   * - Verifies the JWT's signature using the appropriate public key from a JWKS endpoint.
   *
   * @param {string} idToken - The ID Token (JWT) to validate.
   * @param {string} [nonce] - The expected nonce value, if applicable.
   * @returns {Promise<JwtPayload>} The validated JWT payload.
   *
   * @throws {ClientError} If the JWT is invalid, the signature verification fails, or any claim validations fail.
   *
   * @example
   * ```typescript
   * const jwtValidator: IJwtValidator = new JwtValidator(logger, clientMetadata, clientId);
   * try {
   *   const payload = await jwtValidator.validateIdToken(idToken, expectedNonce);
   *   console.log('JWT is valid:', payload);
   * } catch (error) {
   *   console.error('JWT validation failed:', error);
   * }
   * ```
   */
  validateIdToken(idToken: string, nonce?: string): Promise<JwtPayload>;
}
