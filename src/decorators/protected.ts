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

    descriptor.value = async function (...args: any[]) {
      const req: IRequest = args[0];
      const res: IResponse | undefined = args.length > 1 ? args[1] : undefined;

      if (!req) {
        throw new HttpException(
          'Server error: Request object not provided',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const client: Client = this.client;
      if (!client) {
        const message = 'Server configuration error: Client not available';
        if (res) {
          return res.status(StatusCode.INTERNAL_SERVER_ERROR).send(message);
        }
        throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (!req.session || !req.session.user) {
        const message = 'Unauthorized: No valid session';
        if (res) {
          return res.status(StatusCode.UNAUTHORIZED).send(message);
        }
        throw new HttpException(message, HttpStatus.UNAUTHORIZED);
      }

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

      return originalMethod.apply(this, args);
    };

    // Preserve parameter and return type metadata for NestJS to correctly inject dependencies
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
