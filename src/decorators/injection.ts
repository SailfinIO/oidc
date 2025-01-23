import { ProviderScopeOptions } from '../enums/ProviderScopeOptions';
import { MetadataManager } from './MetadataManager';

export type InjectableOptions = ProviderScopeOptions;

export const Injectable = (options?: InjectableOptions): ClassDecorator => {
  return (target: Function) => {
    MetadataManager.setClassMetadata(target, { injectable: options });
  };
};

export const Inject = <T = any>(
  token?: T,
): PropertyDecorator & ParameterDecorator => {
  return (
    target: Object,
    propertyKey: string | symbol | undefined,
    parameterIndex?: number,
  ) => {
    // Assign 'constructor' as the key if propertyKey is undefined
    const key = propertyKey ?? 'constructor';
    const injectToken = token;

    // Cast 'target' to 'Function' if the key is 'constructor'
    const metadataTarget =
      key === 'constructor' ? (target as Function) : target.constructor;

    if (typeof parameterIndex === 'number') {
      const existingParameters =
        MetadataManager.getMethodMetadata(metadataTarget, key)?.inject || [];
      existingParameters[parameterIndex] = injectToken;
      MetadataManager.setMethodMetadata(metadataTarget, key, {
        inject: existingParameters,
      });
    } else {
      MetadataManager.setMethodMetadata(metadataTarget, key, {
        inject: injectToken,
      });
    }
  };
};
