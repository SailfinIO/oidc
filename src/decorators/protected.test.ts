import { Protected } from './protected';
import { MetadataManager } from './MetadataManager';
import { Claims, RequestMethod, RouteAction } from '../enums';

jest.mock('./MetadataManager');

describe('Protected Decorator', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should set default method and route metadata', () => {
    class TestController {
      @Protected()
      testMethod() {}
    }

    const methodMetadataCalls = (MetadataManager.setMethodMetadata as jest.Mock)
      .mock.calls;
    expect(methodMetadataCalls).toHaveLength(1);
    const [targetCtor, methodName, methodMetadata] = methodMetadataCalls[0];
    expect(targetCtor).toBe(TestController);
    expect(methodName).toBe('testMethod');
    expect(methodMetadata).toEqual({
      requiresAuth: true,
      requiredClaims: undefined,
    });

    const routeMetadataCalls = (MetadataManager.setRouteMetadata as jest.Mock)
      .mock.calls;
    expect(routeMetadataCalls).toHaveLength(1);
    const [reqMethod, path, routeMetadata] = routeMetadataCalls[0];
    expect(reqMethod).toBe(RequestMethod.GET);
    expect(path).toBe('/testMethod');
    expect(routeMetadata).toEqual({
      requiresAuth: true,
      requiredClaims: undefined,
      action: RouteAction.Protected,
    });
  });

  it('should set method and route metadata with specific claims', () => {
    class TestController {
      @Protected(RequestMethod.GET, [Claims.Profile, Claims.Email])
      anotherMethod() {}
    }

    const methodMetadataCalls = (MetadataManager.setMethodMetadata as jest.Mock)
      .mock.calls;
    expect(methodMetadataCalls).toHaveLength(1);
    const [targetCtor, methodName, methodMetadata] = methodMetadataCalls[0];
    expect(targetCtor).toBe(TestController);
    expect(methodName).toBe('anotherMethod');
    expect(methodMetadata).toEqual({
      requiresAuth: true,
      requiredClaims: [Claims.Profile, Claims.Email],
    });

    const routeMetadataCalls = (MetadataManager.setRouteMetadata as jest.Mock)
      .mock.calls;
    expect(routeMetadataCalls).toHaveLength(1);
    const [reqMethod, path, routeMetadata] = routeMetadataCalls[0];
    expect(reqMethod).toBe(RequestMethod.GET);
    expect(path).toBe('/anotherMethod');
    expect(routeMetadata).toEqual({
      requiresAuth: true,
      requiredClaims: [Claims.Profile, Claims.Email],
      action: RouteAction.Protected,
    });
  });
});
