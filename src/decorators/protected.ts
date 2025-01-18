import { MetadataManager } from './MetadataManager';
import { IMethodMetadata } from '../interfaces';
import { Claims, StatusCode } from '../enums';
import { Client } from '../classes/Client';
import { HttpException } from '../errors/HttpExeption';

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
        throw new HttpException(message, StatusCode.INTERNAL_SERVER_ERROR);
      }

      try {
        const token = req.session?.cookie?.access_token;
        if (!token) {
          const message = 'Unauthorized: No access token found';
          logger.warn(message);
          if (res) {
            return res.status(StatusCode.UNAUTHORIZED).send(message);
          }
          throw new HttpException(message, StatusCode.UNAUTHORIZED);
        }

        const isValid = await client.introspectToken(token);
        if (!isValid) {
          const message = 'Unauthorized: Invalid or expired access token';
          logger.warn(message);
          if (res) {
            return res.status(StatusCode.UNAUTHORIZED).send(message);
          }
          throw new HttpException(message, StatusCode.UNAUTHORIZED);
        }

        logger.debug('Access token is valid');
      } catch (error) {
        const message = 'Error validating access token';
        logger.error(message, { error });
        if (res) {
          return res.status(StatusCode.INTERNAL_SERVER_ERROR).send(message);
        }
        throw new HttpException(message, StatusCode.INTERNAL_SERVER_ERROR);
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
            throw new HttpException(message, StatusCode.FORBIDDEN);
          }
          logger.debug('All required claims are present', { claimsRecord });
        } catch (error) {
          const message = 'Error retrieving user claims';
          logger.error(message, { error });
          if (res) {
            return res.status(StatusCode.INTERNAL_SERVER_ERROR).send(message);
          }
          throw new HttpException(message, StatusCode.INTERNAL_SERVER_ERROR);
        }
      }

      logger.debug('Authorization checks passed. Invoking original method.');
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
};
