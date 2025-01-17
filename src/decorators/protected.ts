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
    // Attach metadata for potential future use
    MetadataManager.setMethodMetadata(
      target.constructor,
      propertyKey as string,
      { requiresAuth: true, requiredClaims } as IMethodMetadata,
    );

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Ensure at least one argument (request) is provided
      if (!args || args.length < 1) {
        throw new HttpException(
          'Insufficient arguments: Expected at least a request object.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const req: IRequest = args[0];
      const res: IResponse | undefined = args.length > 1 ? args[1] : undefined;

      // Additional guard: check if req is defined
      if (!req) {
        throw new HttpException(
          'Server error: Request object not provided',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Assume that the controller instance has a Client instance as `this.client`
      const client: Client = this.client;
      if (!client) {
        const message = 'Server configuration error: Client not available';
        if (res) {
          return res.status(StatusCode.INTERNAL_SERVER_ERROR).send(message);
        }
        throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Check if session exists and user is authenticated
      if (!req.session || !req.session.user) {
        const message = 'Unauthorized: No valid session';
        if (res) {
          return res.status(StatusCode.UNAUTHORIZED).send(message);
        }
        throw new HttpException(message, HttpStatus.UNAUTHORIZED);
      }

      // Validate required claims if specified
      if (requiredClaims && requiredClaims.length > 0) {
        try {
          const claimsRecord = await client.getClaims();
          const missingClaims = requiredClaims.filter(
            (claim) => !(claim in claimsRecord),
          );
          if (missingClaims.length > 0) {
            const message = 'Forbidden: Missing required claims';
            if (res) {
              return res.status(StatusCode.FORBIDDEN).send(message);
            }
            throw new HttpException(message, HttpStatus.FORBIDDEN);
          }
        } catch (error) {
          const message = 'Error retrieving user claims';
          if (res) {
            return res.status(StatusCode.INTERNAL_SERVER_ERROR).send(message);
          }
          throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }

      // All checks passed; call the original method
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
};
