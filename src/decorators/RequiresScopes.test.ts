// src/decorators/RequiresScopes.test.ts
import { RequiresScopes } from './requiresScopes';
import { MetadataManager } from './MetadataManager';
import { Scopes } from '../enums/Scopes';

// Mock the MetadataManager
jest.mock('./MetadataManager');

describe('RequiresScopes Decorator', () => {
  let setMethodMetadataMock: jest.Mock;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Retrieve the mocked setMethodMetadata
    setMethodMetadataMock = MetadataManager.setMethodMetadata as jest.Mock;
  });

  it('should set requiredScopes metadata with a single scope', () => {
    class TestClass {
      @RequiresScopes(Scopes.Email)
      someMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'someMethod',
      { requiredScopes: [Scopes.Email] },
    );
  });

  it('should set requiredScopes metadata with multiple scopes', () => {
    class TestClass {
      @RequiresScopes(Scopes.Email, Scopes.Profile, Scopes.OfflineAccess)
      someMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'someMethod',
      { requiredScopes: [Scopes.Email, Scopes.Profile, Scopes.OfflineAccess] },
    );
  });

  it('should handle symbol property keys', () => {
    const methodSymbol = Symbol('symbolMethod');

    class TestClass {
      @RequiresScopes(Scopes.Email, Scopes.Profile)
      [methodSymbol]() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'Symbol(symbolMethod)',
      { requiredScopes: [Scopes.Email, Scopes.Profile] },
    );
  });

  it('should throw if MetadataManager.setMethodMetadata throws an error', () => {
    setMethodMetadataMock.mockImplementation(() => {
      throw new Error('MetadataManager error');
    });

    expect(() => {
      class TestClass {
        @RequiresScopes(Scopes.Email)
        someMethod() {}
      }
    }).toThrow('MetadataManager error');
  });

  it('should not interfere with methods without the decorator', () => {
    class TestClass {
      @RequiresScopes(Scopes.Email)
      decoratedMethod() {}

      undecoratedMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledTimes(1);
    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'decoratedMethod',
      { requiredScopes: [Scopes.Email] },
    );
  });

  it('should set requiredScopes metadata for methods in derived classes', () => {
    class BaseClass {
      @RequiresScopes(Scopes.Email)
      baseMethod() {}
    }

    class DerivedClass extends BaseClass {
      @RequiresScopes(Scopes.Profile, Scopes.OfflineAccess)
      derivedMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      BaseClass,
      'baseMethod',
      { requiredScopes: [Scopes.Email] },
    );
    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      DerivedClass,
      'derivedMethod',
      { requiredScopes: [Scopes.Profile, Scopes.OfflineAccess] },
    );
  });

  it('should not modify the decorated method', () => {
    class TestClass {
      @RequiresScopes(Scopes.Email)
      someMethod() {
        return 'original method';
      }
    }

    const instance = new TestClass();
    expect(instance.someMethod()).toBe('original method');
  });
});
