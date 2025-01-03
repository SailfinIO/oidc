// src/decorators/RequiresAuthentication.test.ts
import { RequiresAuthentication } from './requiresAuthentication';
import { MetadataManager } from './MetadataManager';

// Mock the MetadataManager
jest.mock('./MetadataManager');

describe('RequiresAuthentication Decorator', () => {
  let setMethodMetadataMock: jest.Mock;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Retrieve the mocked setMethodMetadata
    setMethodMetadataMock = MetadataManager.setMethodMetadata as jest.Mock;
  });

  it('should set requiresAuth metadata to true for the decorated method', () => {
    class TestClass {
      @RequiresAuthentication()
      someMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'someMethod',
      { requiresAuth: true },
    );
  });

  it('should set requiresAuth metadata to true for multiple decorated methods', () => {
    class TestClass {
      @RequiresAuthentication()
      methodOne() {}

      @RequiresAuthentication()
      methodTwo() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledTimes(2);
    expect(setMethodMetadataMock).toHaveBeenCalledWith(TestClass, 'methodOne', {
      requiresAuth: true,
    });
    expect(setMethodMetadataMock).toHaveBeenCalledWith(TestClass, 'methodTwo', {
      requiresAuth: true,
    });
  });

  it('should handle symbol property keys', () => {
    const methodSymbol = Symbol('symbolMethod');

    class TestClass {
      @RequiresAuthentication()
      [methodSymbol]() {}
    }

    // Symbols are converted to strings like "Symbol(symbolMethod)"
    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'Symbol(symbolMethod)',
      { requiresAuth: true },
    );
  });

  it('should throw if MetadataManager.setMethodMetadata throws an error', () => {
    setMethodMetadataMock.mockImplementation(() => {
      throw new Error('MetadataManager error');
    });

    expect(() => {
      class TestClass {
        @RequiresAuthentication()
        someMethod() {}
      }
    }).toThrow('MetadataManager error');
  });

  it('should not interfere with methods without the decorator', () => {
    class TestClass {
      @RequiresAuthentication()
      decoratedMethod() {}

      undecoratedMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledTimes(1);
    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'decoratedMethod',
      { requiresAuth: true },
    );
  });

  it('should set requiresAuth metadata to true for methods in derived classes', () => {
    class BaseClass {
      @RequiresAuthentication()
      baseMethod() {}
    }

    class DerivedClass extends BaseClass {
      @RequiresAuthentication()
      derivedMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      BaseClass,
      'baseMethod',
      { requiresAuth: true },
    );
    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      DerivedClass,
      'derivedMethod',
      { requiresAuth: true },
    );
  });

  it('should not modify the decorated method', () => {
    class TestClass {
      @RequiresAuthentication()
      someMethod() {
        return 'original method';
      }
    }

    const instance = new TestClass();
    expect(instance.someMethod()).toBe('original method');
  });
});
