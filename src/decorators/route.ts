import { RequestMethod } from 'src/enums';
import { MetadataManager } from './MetadataManager';

export const Get = (): MethodDecorator => {
  return (target, propertyKey) => {
    MetadataManager.setMethodMetadata(target.constructor, propertyKey, {
      route: { method: RequestMethod.GET },
    });
  };
};
