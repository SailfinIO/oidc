// src/decorators/RequiresClaim.test.ts
import { RequiresClaim } from './RequiresClaim';
import { MetadataManager } from './MetadataManager';

// Mock the MetadataManager
jest.mock('./MetadataManager');

describe('RequiresClaim Decorator', () => {
  let setMethodMetadataMock: jest.Mock;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Retrieve the mocked setMethodMetadata
    setMethodMetadataMock = MetadataManager.setMethodMetadata as jest.Mock;
  });

  it('should set requiredClaim metadata with claimKey and claimValue', () => {
    class TestClass {
      @RequiresClaim('role', 'admin')
      someMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'someMethod',
      { requiredClaim: { claimKey: 'role', claimValue: 'admin' } },
    );
  });

  it('should set requiredClaim metadata with claimKey only (claimValue undefined)', () => {
    class TestClass {
      @RequiresClaim('role')
      someMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'someMethod',
      { requiredClaim: { claimKey: 'role', claimValue: undefined } },
    );
  });

  it('should handle symbol property keys', () => {
    const methodSymbol = Symbol('symbolMethod');

    class TestClass {
      @RequiresClaim('role', 'admin')
      [methodSymbol]() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'Symbol(symbolMethod)',
      { requiredClaim: { claimKey: 'role', claimValue: 'admin' } },
    );
  });

  it('should throw if MetadataManager.setMethodMetadata throws an error', () => {
    setMethodMetadataMock.mockImplementation(() => {
      throw new Error('MetadataManager error');
    });

    expect(() => {
      class TestClass {
        @RequiresClaim('role', 'admin')
        someMethod() {}
      }
    }).toThrow('MetadataManager error');
  });

  it('should not interfere with methods without the decorator', () => {
    class TestClass {
      @RequiresClaim('role', 'admin')
      decoratedMethod() {}

      undecoratedMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledTimes(1);
    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'decoratedMethod',
      { requiredClaim: { claimKey: 'role', claimValue: 'admin' } },
    );
  });

  it('should set requiredClaim metadata for methods in derived classes', () => {
    class BaseClass {
      @RequiresClaim('role', 'user')
      baseMethod() {}
    }

    class DerivedClass extends BaseClass {
      @RequiresClaim('role', 'admin')
      derivedMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      BaseClass,
      'baseMethod',
      { requiredClaim: { claimKey: 'role', claimValue: 'user' } },
    );
    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      DerivedClass,
      'derivedMethod',
      { requiredClaim: { claimKey: 'role', claimValue: 'admin' } },
    );
  });

  it('should not modify the decorated method', () => {
    class TestClass {
      @RequiresClaim('role', 'admin')
      someMethod() {
        return 'original method';
      }
    }

    const instance = new TestClass();
    expect(instance.someMethod()).toBe('original method');
  });
});
