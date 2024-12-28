import { ClientError } from '../errors/ClientError';
import {
  ILogger,
  IJwks,
  JwtHeader,
  JwtPayload,
  ClientMetadata,
  IClaimsValidator,
  ISignatureVerifier,
  IJwtValidator,
} from '../interfaces';
import { Jwks } from './Jwks';
import { ClaimsValidator } from './ClaimsValidator';
import { SignatureVerifier } from './SignatureVerifier';
import { base64UrlDecode } from '../utils/urlUtils';

export class JwtValidator implements IJwtValidator {
  private readonly jwks: IJwks;
  private readonly logger: ILogger;
  private readonly claimsValidator: IClaimsValidator;
  private readonly signatureVerifier: ISignatureVerifier;

  constructor(
    logger: ILogger,
    client: ClientMetadata,
    clientId: string,
    jwks?: IJwks,
    claimsValidator?: IClaimsValidator,
    signatureVerifier?: ISignatureVerifier,
  ) {
    this.logger = logger;
    this.jwks = jwks || new Jwks(client.jwks_uri, logger);
    this.claimsValidator =
      claimsValidator || new ClaimsValidator(client.issuer, clientId);
    this.signatureVerifier =
      signatureVerifier || new SignatureVerifier(this.jwks);
  }

  public async validateIdToken(
    idToken: string,
    nonce?: string,
  ): Promise<JwtPayload> {
    this.logger.debug('Starting ID token validation process');

    const { header, payload } = this.decodeJwt(idToken);
    this.logger.debug('JWT successfully decoded', { header, payload });

    try {
      this.claimsValidator.validate(payload, nonce);
      this.logger.debug('Claims validated successfully');
    } catch (err) {
      this.logger.error('Claims validation failed', { error: err });
      throw err;
    }

    try {
      await this.signatureVerifier.verify(header, idToken);
      this.logger.debug('Signature verified successfully');
    } catch (err) {
      this.logger.error('Signature verification failed', { error: err });
      throw err;
    }

    return payload;
  }

  private decodeJwt(jwt: string): { header: JwtHeader; payload: JwtPayload } {
    this.logger.debug('Decoding JWT', { jwt });
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      this.logger.error('Invalid JWT format, expected 3 parts');
      throw new ClientError('Invalid JWT format', 'ID_TOKEN_VALIDATION_ERROR');
    }

    try {
      const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf-8'));
      const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf-8'));
      this.logger.debug('Successfully decoded JWT header and payload', {
        header,
        payload,
      });
      return { header, payload };
    } catch (err) {
      this.logger.error('Invalid JWT format during decode', { error: err });
      throw new ClientError('Invalid JWT format', 'ID_TOKEN_VALIDATION_ERROR');
    }
  }
}
