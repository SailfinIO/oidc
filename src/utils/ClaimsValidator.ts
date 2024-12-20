// src/utils/ClaimsValidator.ts

import { ClientError } from '../errors/ClientError';
import { JwtPayload } from '../interfaces';

export class ClaimsValidator {
  private expectedIssuer: string;
  private expectedAudience: string;
  private maxFutureSec: number;

  constructor(
    expectedIssuer: string,
    expectedAudience: string,
    maxFutureSec = 300,
  ) {
    this.expectedIssuer = expectedIssuer;
    this.expectedAudience = expectedAudience;
    this.maxFutureSec = maxFutureSec;
  }

  public validate(payload: JwtPayload, nonce?: string): void {
    this.validateIssuer(payload.iss);
    this.validateAudience(payload.aud);
    this.validateAzp(payload);
    this.validateTimestamps(payload);
    this.validateNonce(payload, nonce);
  }

  private validateIssuer(iss?: string): void {
    if (iss !== this.expectedIssuer) {
      throw new ClientError(
        `Invalid issuer: ${iss}`,
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }

  private validateAudience(aud: string | string[] | undefined): void {
    const audArray = Array.isArray(aud) ? aud : [aud];
    if (!audArray.includes(this.expectedAudience)) {
      throw new ClientError(
        'Audience not found in ID token',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }

  private validateAzp(payload: JwtPayload): void {
    const audArray = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (
      audArray.length > 1 &&
      payload.azp &&
      payload.azp !== this.expectedAudience
    ) {
      throw new ClientError(
        'Invalid authorized party (azp) in ID token',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }

  private validateTimestamps(payload: JwtPayload): void {
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new ClientError('ID token is expired', 'ID_TOKEN_VALIDATION_ERROR');
    }
    if (payload.iat && payload.iat > now + this.maxFutureSec) {
      throw new ClientError(
        'ID token iat is too far in the future',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
    if (payload.nbf && payload.nbf > now) {
      throw new ClientError(
        'ID token not valid yet (nbf)',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }

  private validateNonce(payload: JwtPayload, nonce?: string): void {
    if (nonce && payload.nonce !== nonce) {
      throw new ClientError(
        'Invalid nonce in ID token',
        'ID_TOKEN_VALIDATION_ERROR',
      );
    }
  }
}
