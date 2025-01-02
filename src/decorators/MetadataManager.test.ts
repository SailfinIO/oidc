// src/decorators/MetadataManager.test.ts
import { MetadataManager } from './MetadataManager';
import { IClassMetadata, IMethodMetadata, IRouteMetadata } from '../interfaces';
import { KeyFactory } from './KeyFactory';
import { Cache } from '../cache/Cache';
import { ILogger } from '../interfaces';

// Mock the Cache and Logger
jest.mock('../cache/Cache');
jest.mock('../utils/Logger');

const MockedCache = Cache as jest.MockedClass<typeof Cache>;

describe('MetadataManager', () => {
  class TestClass {}
  class AnotherTestClass {}
  let logger: ILogger;
  let classCacheMock: jest.Mocked<Cache<IClassMetadata>>;
  let methodCacheMock: jest.Mocked<Cache<IMethodMetadata>>;
  let routeCacheMock: jest.Mocked<Cache<IRouteMetadata>>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Create a mocked logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };

    // Set up mocked Cache instances for class and method metadata
    classCacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<Cache<IClassMetadata>>;

    methodCacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<Cache<IMethodMetadata>>;

    routeCacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<Cache<IRouteMetadata>>;

    // Mock the Cache constructor to return classCacheMock first, then methodCacheMock, then routeCacheMock
    MockedCache.mockImplementationOnce(() => classCacheMock as any)
      .mockImplementationOnce(() => methodCacheMock as any)
      .mockImplementationOnce(() => routeCacheMock as any);

    // Mock KeyFactory.getKeyForFunction to return unique keys
    jest
      .spyOn(KeyFactory, 'getKeyForFunction')
      .mockImplementation((target: Function) => {
        if (target === TestClass) return 'ctor_1';
        if (target === AnotherTestClass) return 'ctor_2';
        return 'unknown_ctor';
      });

    // Initialize MetadataManager with the mocked logger
    MetadataManager.init(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Class Metadata', () => {
    it('sets and merges class metadata', () => {
      const metadata: Partial<IClassMetadata> = { foo: 'bar' };
      MetadataManager.setClassMetadata(TestClass, metadata);

      expect(classCacheMock.get).toHaveBeenCalledWith('class:ctor_1');
      expect(classCacheMock.set).toHaveBeenCalledWith('class:ctor_1', metadata);

      // Mock the get to return the merged metadata
      classCacheMock.get.mockReturnValueOnce(metadata);
      const result = MetadataManager.getClassMetadata(TestClass);
      expect(classCacheMock.get).toHaveBeenCalledWith('class:ctor_1');
      expect(result).toEqual(metadata);
    });

    it('overwrites existing class metadata with the same keys', () => {
      const initialMetadata: Partial<IClassMetadata> = { foo: 'bar' };
      classCacheMock.get.mockReturnValueOnce(initialMetadata);

      MetadataManager.setClassMetadata(TestClass, initialMetadata);

      const updatedMetadata: Partial<IClassMetadata> = { foo: 'newBar' };
      classCacheMock.get.mockReturnValueOnce(initialMetadata);
      MetadataManager.setClassMetadata(TestClass, updatedMetadata);

      expect(classCacheMock.set).toHaveBeenCalledWith('class:ctor_1', {
        foo: 'newBar',
      });

      classCacheMock.get.mockReturnValueOnce({ foo: 'newBar' });
      const result = MetadataManager.getClassMetadata(TestClass);
      expect(result).toEqual({ foo: 'newBar' });
    });

    it('handles multiple classes independently', () => {
      const metadata1: Partial<IClassMetadata> = { foo: 'bar' };
      const metadata2: Partial<IClassMetadata> = { alpha: 'beta' };

      // Set class metadata
      MetadataManager.setClassMetadata(TestClass, metadata1);
      MetadataManager.setClassMetadata(AnotherTestClass, metadata2);

      // Check that each class was set with its own cache key
      expect(classCacheMock.set).toHaveBeenCalledWith(
        'class:ctor_1',
        metadata1,
      );
      expect(classCacheMock.set).toHaveBeenCalledWith(
        'class:ctor_2',
        metadata2,
      );

      // Mock get to return respective metadata
      classCacheMock.get.mockImplementation((key: string) => {
        if (key === 'class:ctor_1') return metadata1;
        if (key === 'class:ctor_2') return metadata2;
        return undefined;
      });

      const result1 = MetadataManager.getClassMetadata(TestClass);
      const result2 = MetadataManager.getClassMetadata(AnotherTestClass);

      expect(result1).toEqual(metadata1);
      expect(result2).toEqual(metadata2);
    });

    it('returns undefined for classes with no metadata', () => {
      classCacheMock.get.mockReturnValueOnce(undefined);
      expect(
        MetadataManager.getClassMetadata(function NoMetadata() {}),
      ).toBeUndefined();
    });

    it('handles invalid targets gracefully', () => {
      expect(() =>
        MetadataManager.setClassMetadata(null as any, { foo: 'bar' }),
      ).toThrow(
        'setClassMetadata expects a constructor function as the target.',
      );
      expect(() =>
        MetadataManager.setClassMetadata(undefined as any, { foo: 'bar' }),
      ).toThrow(
        'setClassMetadata expects a constructor function as the target.',
      );

      expect(() => MetadataManager.getClassMetadata(null as any)).toThrow(
        'getClassMetadata expects a constructor function as the target.',
      );
      expect(() => MetadataManager.getClassMetadata(undefined as any)).toThrow(
        'getClassMetadata expects a constructor function as the target.',
      );
    });
  });

  describe('Method Metadata', () => {
    it('sets and merges method metadata', () => {
      const metadata: Partial<IMethodMetadata> = { automaticRefresh: true };
      MetadataManager.setMethodMetadata(TestClass, 'someMethod', metadata);

      expect(methodCacheMock.get).toHaveBeenCalledWith(
        'method:ctor_1:someMethod',
      );
      expect(methodCacheMock.set).toHaveBeenCalledWith(
        'method:ctor_1:someMethod',
        metadata,
      );

      // Mock the get to return the merged metadata
      methodCacheMock.get.mockReturnValueOnce(metadata);
      const result = MetadataManager.getMethodMetadata(TestClass, 'someMethod');
      expect(methodCacheMock.get).toHaveBeenCalledWith(
        'method:ctor_1:someMethod',
      );
      expect(result).toEqual(metadata);
    });

    it('overwrites existing method metadata with the same keys', () => {
      const initialMetadata: Partial<IMethodMetadata> = {
        automaticRefresh: true,
      };
      methodCacheMock.get.mockReturnValueOnce(initialMetadata);

      MetadataManager.setMethodMetadata(
        TestClass,
        'someMethod',
        initialMetadata,
      );

      const updatedMetadata: Partial<IMethodMetadata> = {
        automaticRefresh: false,
      };
      methodCacheMock.get.mockReturnValueOnce(initialMetadata);
      MetadataManager.setMethodMetadata(
        TestClass,
        'someMethod',
        updatedMetadata,
      );

      expect(methodCacheMock.set).toHaveBeenCalledWith(
        'method:ctor_1:someMethod',
        { automaticRefresh: false },
      );

      methodCacheMock.get.mockReturnValueOnce({ automaticRefresh: false });
      const result = MetadataManager.getMethodMetadata(TestClass, 'someMethod');
      expect(result).toEqual({ automaticRefresh: false });
    });

    it('handles multiple methods independently', () => {
      const metadata1: Partial<IMethodMetadata> = { automaticRefresh: true };
      const metadata2: Partial<IMethodMetadata> = { requiresAuth: true };

      // Set method metadata
      MetadataManager.setMethodMetadata(TestClass, 'methodOne', metadata1);
      MetadataManager.setMethodMetadata(TestClass, 'methodTwo', metadata2);

      // Check that each method was set with its own cache key
      expect(methodCacheMock.set).toHaveBeenCalledWith(
        'method:ctor_1:methodOne',
        metadata1,
      );
      expect(methodCacheMock.set).toHaveBeenCalledWith(
        'method:ctor_1:methodTwo',
        metadata2,
      );

      // Mock get to return respective metadata
      methodCacheMock.get.mockImplementation((key: string) => {
        if (key === 'method:ctor_1:methodOne') return metadata1;
        if (key === 'method:ctor_1:methodTwo') return metadata2;
        return undefined;
      });

      const result1 = MetadataManager.getMethodMetadata(TestClass, 'methodOne');
      const result2 = MetadataManager.getMethodMetadata(TestClass, 'methodTwo');

      expect(result1).toEqual(metadata1);
      expect(result2).toEqual(metadata2);
    });

    it('returns undefined for methods with no metadata', () => {
      methodCacheMock.get.mockReturnValueOnce(undefined);
      expect(
        MetadataManager.getMethodMetadata(TestClass, 'nonExistentMethod'),
      ).toBeUndefined();
    });

    it('handles invalid targets gracefully', () => {
      expect(() =>
        MetadataManager.setMethodMetadata(null as any, 'method', {
          automaticRefresh: true,
        }),
      ).toThrow(
        'setMethodMetadata expects a constructor function as the targetConstructor.',
      );

      expect(() =>
        MetadataManager.setMethodMetadata(undefined as any, 'method', {
          automaticRefresh: true,
        }),
      ).toThrow(
        'setMethodMetadata expects a constructor function as the targetConstructor.',
      );

      expect(() =>
        MetadataManager.getMethodMetadata(null as any, 'method'),
      ).toThrow(
        'getMethodMetadata expects a constructor function as the targetConstructor.',
      );

      expect(() =>
        MetadataManager.getMethodMetadata(undefined as any, 'method'),
      ).toThrow(
        'getMethodMetadata expects a constructor function as the targetConstructor.',
      );
    });

    it('handles invalid propertyKeys gracefully', () => {
      expect(() =>
        MetadataManager.setMethodMetadata(TestClass, null as any, {
          automaticRefresh: true,
        }),
      ).toThrow('setMethodMetadata expects a string as the propertyKey.');

      expect(() =>
        MetadataManager.setMethodMetadata(TestClass, undefined as any, {
          automaticRefresh: true,
        }),
      ).toThrow('setMethodMetadata expects a string as the propertyKey.');

      expect(() =>
        MetadataManager.getMethodMetadata(TestClass, null as any),
      ).toThrow('getMethodMetadata expects a string as the propertyKey.');

      expect(() =>
        MetadataManager.getMethodMetadata(TestClass, undefined as any),
      ).toThrow('getMethodMetadata expects a string as the propertyKey.');
    });
  });

  describe('Reset Functionality', () => {
    it('clears all class, method, and route metadata', () => {
      // Set class metadata
      MetadataManager.setClassMetadata(TestClass, { foo: 'bar' });
      // Set method metadata
      MetadataManager.setMethodMetadata(TestClass, 'someMethod', {
        requiresAuth: true,
      });
      // Set route metadata
      MetadataManager.setRouteMetadata('GET', '/login', { requiresAuth: true });

      // Ensure metadata is set
      expect(classCacheMock.set).toHaveBeenCalledWith('class:ctor_1', {
        foo: 'bar',
      });
      expect(methodCacheMock.set).toHaveBeenCalledWith(
        'method:ctor_1:someMethod',
        { requiresAuth: true },
      );
      expect(routeCacheMock.set).toHaveBeenCalledWith('route:GET:/login', {
        requiresAuth: true,
      });

      // Mock clear methods
      classCacheMock.clear.mockImplementation(() => {});
      methodCacheMock.clear.mockImplementation(() => {});
      routeCacheMock.clear.mockImplementation(() => {});

      // Reset caches
      MetadataManager.reset();

      // Ensure clear was called on all caches
      expect(classCacheMock.clear).toHaveBeenCalled();
      expect(methodCacheMock.clear).toHaveBeenCalled();
      expect(routeCacheMock.clear).toHaveBeenCalled();
    });

    it('throws an error if reset is called before initialization', () => {
      // Simulate caches being undefined
      (MetadataManager as any).classMetadataCache = undefined;
      (MetadataManager as any).methodMetadataCache = undefined;
      (MetadataManager as any).routeMetadataCache = undefined;

      expect(() => MetadataManager.reset()).toThrow(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    });
  });

  describe('Initialization Behavior', () => {
    it('throws an error if init is not called before using MetadataManager', () => {
      // Reset caches to simulate not initialized state
      (MetadataManager as any).classMetadataCache = undefined;
      (MetadataManager as any).methodMetadataCache = undefined;
      (MetadataManager as any).routeMetadataCache = undefined;

      expect(() =>
        MetadataManager.setClassMetadata(TestClass, { foo: 'bar' }),
      ).toThrow(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
      expect(() => MetadataManager.getClassMetadata(TestClass)).toThrow(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );

      expect(() =>
        MetadataManager.setMethodMetadata(TestClass, 'someMethod', {
          requiresAuth: true,
        }),
      ).toThrow(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
      expect(() =>
        MetadataManager.getMethodMetadata(TestClass, 'someMethod'),
      ).toThrow(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );

      expect(() =>
        MetadataManager.setRouteMetadata('GET', '/login', {
          requiresAuth: true,
        }),
      ).toThrow(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    });

    it('allows re-initialization and retains functionality for route metadata', () => {
      // Mock a different logger
      const newLogger: ILogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
      };

      // Set up new Cache mocks for class, method, and route metadata
      const newClassCacheMock: jest.Mocked<Cache<IClassMetadata>> = {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
      } as unknown as jest.Mocked<Cache<IClassMetadata>>;

      const newMethodCacheMock: jest.Mocked<Cache<IMethodMetadata>> = {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
      } as unknown as jest.Mocked<Cache<IMethodMetadata>>;

      const newRouteCacheMock: jest.Mocked<Cache<IRouteMetadata>> = {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
      } as unknown as jest.Mocked<Cache<IRouteMetadata>>;

      // Mock Cache constructor to return newClassCacheMock, newMethodCacheMock, and newRouteCacheMock
      MockedCache.mockImplementationOnce(() => newClassCacheMock as any)
        .mockImplementationOnce(() => newMethodCacheMock as any)
        .mockImplementationOnce(() => newRouteCacheMock as any);

      // Re-initialize MetadataManager with the new logger
      MetadataManager.init(newLogger);

      // Mock KeyFactory.getKeyForFunction to return 'ctor_1' for TestClass
      jest
        .spyOn(KeyFactory, 'getKeyForFunction')
        .mockImplementation((target: Function) => {
          if (target === TestClass) return 'ctor_1';
          return 'unknown_ctor';
        });

      // Set and get class metadata
      MetadataManager.setClassMetadata(TestClass, { foo: 'bar' });
      expect(newClassCacheMock.set).toHaveBeenCalledWith('class:ctor_1', {
        foo: 'bar',
      });

      newClassCacheMock.get.mockReturnValueOnce({ foo: 'bar' });
      const classResult = MetadataManager.getClassMetadata(TestClass);
      expect(newClassCacheMock.get).toHaveBeenCalledWith('class:ctor_1');
      expect(classResult).toEqual({ foo: 'bar' });

      // Set and get method metadata
      MetadataManager.setMethodMetadata(TestClass, 'someMethod', {
        requiresAuth: true,
      });
      expect(newMethodCacheMock.set).toHaveBeenCalledWith(
        'method:ctor_1:someMethod',
        { requiresAuth: true },
      );

      newMethodCacheMock.get.mockReturnValueOnce({ requiresAuth: true });
      const methodResult = MetadataManager.getMethodMetadata(
        TestClass,
        'someMethod',
      );
      expect(newMethodCacheMock.get).toHaveBeenCalledWith(
        'method:ctor_1:someMethod',
      );
      expect(methodResult).toEqual({ requiresAuth: true });

      // Set and get route metadata
      MetadataManager.setRouteMetadata('POST', '/submit', {
        requiresAuth: true,
      });
      expect(newRouteCacheMock.set).toHaveBeenCalledWith('route:POST:/submit', {
        requiresAuth: true,
      });

      newRouteCacheMock.get.mockReturnValueOnce({ requiresAuth: true });
      const routeResult = MetadataManager.getRouteMetadata('POST', '/submit');
      expect(newRouteCacheMock.get).toHaveBeenCalledWith('route:POST:/submit');
      expect(routeResult).toEqual({ requiresAuth: true });
    });
  });

  describe('Cache Key Generation', () => {
    it('generates unique keys for different constructors', () => {
      // KeyFactory.getKeyForFunction is already mocked in beforeEach
      MetadataManager.setClassMetadata(TestClass, { foo: 'bar' });
      MetadataManager.setClassMetadata(AnotherTestClass, { alpha: 'beta' });

      expect(KeyFactory.getKeyForFunction).toHaveBeenCalledWith(TestClass);
      expect(KeyFactory.getKeyForFunction).toHaveBeenCalledWith(
        AnotherTestClass,
      );
      expect(KeyFactory.getKeyForFunction).toHaveBeenCalledTimes(2);

      expect(classCacheMock.set).toHaveBeenCalledWith('class:ctor_1', {
        foo: 'bar',
      });
      expect(classCacheMock.set).toHaveBeenCalledWith('class:ctor_2', {
        alpha: 'beta',
      });
    });

    it('generates the same key for the same constructor', () => {
      // KeyFactory.getKeyForFunction is already mocked to return 'ctor_1' for TestClass
      MetadataManager.setClassMetadata(TestClass, { foo: 'bar' });
      MetadataManager.setClassMetadata(TestClass, { fizz: 'buzz' });

      expect(KeyFactory.getKeyForFunction).toHaveBeenCalledWith(TestClass);
      expect(KeyFactory.getKeyForFunction).toHaveBeenCalledTimes(2);

      expect(classCacheMock.set).toHaveBeenCalledWith('class:ctor_1', {
        foo: 'bar',
      });
      expect(classCacheMock.set).toHaveBeenCalledWith('class:ctor_1', {
        fizz: 'buzz',
      });
    });

    it('generates unique keys for different routes', () => {
      const routes = [
        { method: 'GET', path: '/home', metadata: { requiresAuth: false } },
        { method: 'POST', path: '/submit', metadata: { requiresAuth: true } },
      ];

      // Set metadata for both routes
      MetadataManager.setRouteMetadata(
        routes[0].method,
        routes[0].path,
        routes[0].metadata,
      );
      MetadataManager.setRouteMetadata(
        routes[1].method,
        routes[1].path,
        routes[1].metadata,
      );

      // Check that each route was set with its own cache key
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:GET:/home',
        routes[0].metadata,
      );
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:POST:/submit',
        routes[1].metadata,
      );
    });

    it('handles duplicate routes by updating the same cache key', () => {
      const method = 'PUT';
      const path = '/update';
      const metadata1: IRouteMetadata = { requiresAuth: true };
      const metadata2: IRouteMetadata = {
        postLoginRedirectUri: 'http://dummy.com',
      };
      const mergedMetadata: IRouteMetadata = {
        requiresAuth: true,
        postLoginRedirectUri: 'http://dummy.com',
      };

      // Set initial route metadata
      MetadataManager.setRouteMetadata(method, path, metadata1);
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:PUT:/update',
        metadata1,
      );

      // Mock the existing metadata
      routeCacheMock.get.mockReturnValueOnce(metadata1);

      // Set additional metadata
      MetadataManager.setRouteMetadata(method, path, metadata2);
      expect(routeCacheMock.get).toHaveBeenCalledWith('route:PUT:/update');
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:PUT:/update',
        mergedMetadata,
      );

      // Mock the get to return the merged metadata
      routeCacheMock.get.mockReturnValueOnce(mergedMetadata);

      // Retrieve the merged route metadata
      const result = MetadataManager.getRouteMetadata(method, path);
      expect(routeCacheMock.get).toHaveBeenCalledWith('route:PUT:/update');
      expect(result).toEqual(mergedMetadata);
    });
  });

  describe('Route Metadata', () => {
    it('sets and retrieves route metadata', () => {
      const method = 'GET';
      const path = '/login';
      const metadata: IRouteMetadata = { requiresAuth: true };

      // Set route metadata
      MetadataManager.setRouteMetadata(method, path, metadata);

      // Expect the cache to be set with the correct key and metadata
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:GET:/login',
        metadata,
      );

      // Mock the get to return the metadata
      routeCacheMock.get.mockReturnValueOnce(metadata);

      // Retrieve the route metadata
      const result = MetadataManager.getRouteMetadata(method, path);
      expect(routeCacheMock.get).toHaveBeenCalledWith('route:GET:/login');
      expect(result).toEqual(metadata);
    });

    it('merges route metadata correctly', () => {
      const method = 'POST';
      const path = '/submit';
      const initialMetadata: IRouteMetadata = { requiresAuth: true };
      const additionalMetadata: IRouteMetadata = {
        postLoginRedirectUri: 'http://dummy.com',
      };
      const mergedMetadata: IRouteMetadata = {
        requiresAuth: true,
        postLoginRedirectUri: 'http://dummy.com',
      };

      // Set initial route metadata
      MetadataManager.setRouteMetadata(method, path, initialMetadata);
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:POST:/submit',
        initialMetadata,
      );

      // Mock the existing metadata
      routeCacheMock.get.mockReturnValueOnce(initialMetadata);

      // Set additional metadata
      MetadataManager.setRouteMetadata(method, path, additionalMetadata);
      expect(routeCacheMock.get).toHaveBeenCalledWith('route:POST:/submit');
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:POST:/submit',
        mergedMetadata,
      );

      // Mock the get to return the merged metadata
      routeCacheMock.get.mockReturnValueOnce(mergedMetadata);

      // Retrieve the merged route metadata
      const result = MetadataManager.getRouteMetadata(method, path);
      expect(routeCacheMock.get).toHaveBeenCalledWith('route:POST:/submit');
      expect(result).toEqual(mergedMetadata);
    });

    it('handles multiple routes independently', () => {
      const route1 = {
        method: 'GET',
        path: '/home',
        metadata: { requiresAuth: false },
      };
      const route2 = {
        method: 'POST',
        path: '/submit',
        metadata: { requiresAuth: true },
      };

      // Set metadata for both routes
      MetadataManager.setRouteMetadata(
        route1.method,
        route1.path,
        route1.metadata,
      );
      MetadataManager.setRouteMetadata(
        route2.method,
        route2.path,
        route2.metadata,
      );

      // Check that each route was set with its own cache key
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:GET:/home',
        route1.metadata,
      );
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:POST:/submit',
        route2.metadata,
      );

      // Mock get to return respective metadata
      routeCacheMock.get.mockImplementation((key: string) => {
        if (key === 'route:GET:/home') return route1.metadata;
        if (key === 'route:POST:/submit') return route2.metadata;
        return undefined;
      });

      // Retrieve metadata for both routes
      const result1 = MetadataManager.getRouteMetadata(
        route1.method,
        route1.path,
      );
      const result2 = MetadataManager.getRouteMetadata(
        route2.method,
        route2.path,
      );

      expect(result1).toEqual(route1.metadata);
      expect(result2).toEqual(route2.metadata);
    });

    it('returns undefined for routes with no metadata', () => {
      expect(
        MetadataManager.getRouteMetadata('DELETE', '/remove'),
      ).toBeUndefined();
    });

    it('handles HTTP methods case-insensitively', () => {
      const methodLower = 'get';
      const methodUpper = 'GET';
      const path = '/status';
      const metadata: IRouteMetadata = { requiresAuth: false };

      // Set route metadata with lowercase method
      MetadataManager.setRouteMetadata(methodLower, path, metadata);
      expect(routeCacheMock.set).toHaveBeenCalledWith(
        'route:GET:/status',
        metadata,
      );

      // Mock the get to return the metadata
      routeCacheMock.get.mockReturnValueOnce(metadata);

      // Retrieve using uppercase method
      const result = MetadataManager.getRouteMetadata(methodUpper, path);
      expect(routeCacheMock.get).toHaveBeenCalledWith('route:GET:/status');
      expect(result).toEqual(metadata);
    });

    it('throws an error if caches have not been initialized when setting route metadata', () => {
      // Simulate caches being undefined
      (MetadataManager as any).routeMetadataCache = undefined;

      expect(() =>
        MetadataManager.setRouteMetadata('GET', '/login', {
          requiresAuth: true,
        }),
      ).toThrow(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    });

    it('throws an error if caches have not been initialized when getting route metadata', () => {
      // Simulate caches being undefined
      (MetadataManager as any).routeMetadataCache = undefined;

      expect(() => MetadataManager.getRouteMetadata('GET', '/login')).toThrow(
        'MetadataManager caches have not been initialized. Call MetadataManager.init(logger) before using.',
      );
    });

    it('handles invalid inputs gracefully when setting route metadata', () => {
      // Test with null as method
      expect(() =>
        MetadataManager.setRouteMetadata(null as any, '/login', {
          requiresAuth: true,
        }),
      ).toThrow(
        "setRouteMetadata expects 'method' to be a string, received object.",
      );

      // Test with undefined as method
      expect(() =>
        MetadataManager.setRouteMetadata(undefined as any, '/login', {
          requiresAuth: true,
        }),
      ).toThrow(
        "setRouteMetadata expects 'method' to be a string, received undefined.",
      );

      // Test with non-string path
      expect(() =>
        MetadataManager.setRouteMetadata('GET', null as any, {
          requiresAuth: true,
        }),
      ).toThrow(
        "setRouteMetadata expects 'path' to be a string, received object.",
      );

      // Test with non-string path type
      expect(() =>
        MetadataManager.setRouteMetadata('GET', 123 as any, {
          requiresAuth: true,
        }),
      ).toThrow(
        "setRouteMetadata expects 'path' to be a string, received number.",
      );
    });

    it('handles invalid inputs gracefully when getting route metadata', () => {
      // Test with null as method
      expect(() =>
        MetadataManager.getRouteMetadata(null as any, '/login'),
      ).toThrow(
        "getRouteMetadata expects 'method' to be a string, received object.",
      );

      // Test with undefined as method
      expect(() =>
        MetadataManager.getRouteMetadata(undefined as any, '/login'),
      ).toThrow(
        "getRouteMetadata expects 'method' to be a string, received undefined.",
      );

      // Test with non-string path
      expect(() =>
        MetadataManager.getRouteMetadata('GET', null as any),
      ).toThrow(
        "getRouteMetadata expects 'path' to be a string, received object.",
      );

      // Test with non-string path type
      expect(() => MetadataManager.getRouteMetadata('GET', 123 as any)).toThrow(
        "getRouteMetadata expects 'path' to be a string, received number.",
      );
    });
  });
});