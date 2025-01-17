import { MetadataManager } from './MetadataManager';
import { IMethodMetadata, IRequest, IResponse } from '../interfaces';
import { Claims, StatusCode } from '../enums';
import { Client } from '../classes/Client';

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
      const req: IRequest = args[0];
      const res: IResponse = args[1];

      // Assume that the controller instance has a Client instance as `this.client`
      const client: Client = this.client;
      if (!client) {
        return res
          .status(StatusCode.INTERNAL_SERVER_ERROR)
          .send('Server configuration error: Client not available');
      }

      // Check if session exists and user is authenticated
      if (!req.session || !req.session.user) {
        return res
          .status(StatusCode.UNAUTHORIZED)
          .send('Unauthorized: No valid session');
      }

      // Validate required claims if specified
      if (requiredClaims && requiredClaims.length > 0) {
        try {
          const claimsRecord = await client.getClaims();
          const missingClaims = requiredClaims.filter(
            (claim) => !(claim in claimsRecord),
          );
          if (missingClaims.length > 0) {
            return res
              .status(StatusCode.FORBIDDEN)
              .send('Forbidden: Missing required claims');
          }
        } catch (error) {
          // Handle errors retrieving claims
          return res
            .status(StatusCode.INTERNAL_SERVER_ERROR)
            .send('Error retrieving user claims');
        }
      }

      // All checks passed; call the original method
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
};
