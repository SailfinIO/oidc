import { MetadataManager } from './MetadataManager';
import { IMethodMetadata, IRequest, IResponse } from '../interfaces';
import { Claims, StatusCode } from '../enums';
import { Client } from '../classes/Client';
import { HttpException, HttpStatus } from '@nestjs/common';

export const Protected = (requiredClaims?: Claims[]): MethodDecorator => {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    MetadataManager.setMethodMetadata(
      target.constructor,
      propertyKey as string,
      { requiresAuth: true, requiredClaims } as IMethodMetadata,
    );

    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: { client: Client },
      ...args: any[]
    ) {
      const req: any = args[0];
      const res: any = args[1];
      const client: Client = this.client;
      const logger = client ? client.getLogger() : console;

      logger.debug('Protected decorator invoked', {
        method: propertyKey.toString(),
        requiredClaims,
      });

      if (!req || !res) {
        logger.error('Missing request or response object', { req, res });
        if (res) {
          res
            .status(StatusCode.BAD_REQUEST)
            .send('Invalid callback parameters: Missing request or response.');
        }
        return;
      }

      if (!client) {
        const message = 'Server configuration error: Client not available';
        logger.error(message);
        if (res) {
          return res.status(StatusCode.INTERNAL_SERVER_ERROR).send(message);
        }
        throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Refined check: Verify that session, user, and user.sub exist
      if (!req.session || !req.session.user || !req.session.user.sub) {
        const message = 'Unauthorized: No valid session';
        logger.warn(message, { session: req.session });
        if (res) {
          return res.status(StatusCode.UNAUTHORIZED).send(message);
        }
        throw new HttpException(message, HttpStatus.UNAUTHORIZED);
      }

      try {
        const accessToken = req.session.token?.access_token; // Assume access token is stored in session
        if (accessToken) {
          const introspection = await client.introspectToken(accessToken);
          if (!introspection.active) {
            logger.warn('Token introspection failed: token inactive', {
              introspection,
            });
            return res
              .status(StatusCode.UNAUTHORIZED)
              .send('Unauthorized: Invalid token');
          }
        }
      } catch (error) {
        logger.error('Error during token introspection', { error });
        return res
          .status(StatusCode.INTERNAL_SERVER_ERROR)
          .send('Error validating token');
      }

      if (requiredClaims && requiredClaims.length > 0) {
        try {
          logger.debug('Validating required claims', { requiredClaims });
          const claimsRecord = await client.getClaims();
          const missingClaims = requiredClaims.filter(
            (claim) => !(claim in claimsRecord),
          );
          if (missingClaims.length > 0) {
            const message = 'Forbidden: Missing required claims';
            logger.warn(message, { missingClaims });
            if (res) {
              return res.status(StatusCode.FORBIDDEN).send(message);
            }
            throw new HttpException(message, HttpStatus.FORBIDDEN);
          }
          logger.debug('All required claims are present', { claimsRecord });
        } catch (error) {
          const message = 'Error retrieving user claims';
          logger.error(message, { error });
          if (res) {
            return res.status(StatusCode.INTERNAL_SERVER_ERROR).send(message);
          }
          throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }

      logger.debug('Authorization checks passed. Invoking original method.');
      return originalMethod.apply(this, args);
    };

    // Preserve parameter and return type metadata for NestJS injection
    Reflect.defineMetadata(
      'design:paramtypes',
      Reflect.getMetadata('design:paramtypes', originalMethod),
      descriptor.value,
    );
    Reflect.defineMetadata(
      'design:returntype',
      Reflect.getMetadata('design:returntype', originalMethod),
      descriptor.value,
    );
    Reflect.defineMetadata(
      'design:type',
      Reflect.getMetadata('design:type', originalMethod),
      descriptor.value,
    );

    return descriptor;
  };
};
