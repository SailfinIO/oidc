// src/decorators/AutomaticRefresh.test.ts
import { AutomaticRefresh } from './AutomaticRefresh';
import { MetadataManager } from './MetadataManager';

// Mock the MetadataManager
jest.mock('./MetadataManager');

describe('AutomaticRefresh Decorator', () => {
  let setMethodMetadataMock: jest.Mock;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Retrieve the mocked setMethodMetadata
    setMethodMetadataMock = MetadataManager.setMethodMetadata as jest.Mock;
  });

  it('should set automaticRefresh metadata to true for the decorated method', () => {
    class TestClass {
      @AutomaticRefresh()
      someMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'someMethod',
      { automaticRefresh: true },
    );
  });

  it('should set automaticRefresh metadata to true for multiple decorated methods', () => {
    class TestClass {
      @AutomaticRefresh()
      methodOne() {}

      @AutomaticRefresh()
      methodTwo() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledTimes(2);
    expect(setMethodMetadataMock).toHaveBeenCalledWith(TestClass, 'methodOne', {
      automaticRefresh: true,
    });
    expect(setMethodMetadataMock).toHaveBeenCalledWith(TestClass, 'methodTwo', {
      automaticRefresh: true,
    });
  });

  it('should handle symbol property keys', () => {
    const methodSymbol = Symbol('symbolMethod');

    class TestClass {
      @AutomaticRefresh()
      [methodSymbol]() {}
    }

    // Symbols are now converted to strings like "Symbol(symbolMethod)"
    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'Symbol(symbolMethod)',
      { automaticRefresh: true },
    );
  });

  it('should throw if MetadataManager.setMethodMetadata throws an error', () => {
    setMethodMetadataMock.mockImplementation(() => {
      throw new Error('MetadataManager error');
    });

    expect(() => {
      class TestClass {
        @AutomaticRefresh()
        someMethod() {}
      }
    }).toThrow('MetadataManager error');
  });

  it('should not interfere with methods without the decorator', () => {
    class TestClass {
      @AutomaticRefresh()
      decoratedMethod() {}

      undecoratedMethod() {}
    }

    expect(setMethodMetadataMock).toHaveBeenCalledTimes(1);
    expect(setMethodMetadataMock).toHaveBeenCalledWith(
      TestClass,
      'decoratedMethod',
      { automaticRefresh: true },
    );
  });
});
