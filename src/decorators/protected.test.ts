import { Protected } from './protected';
import { MetadataManager } from './MetadataManager';
import { Claims } from '../enums';
import { IRequest, IResponse } from '../interfaces';
import { Client } from '../classes/Client';

jest.mock('./MetadataManager');

describe('Protected Decorator', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should set method metadata without specific claims', () => {
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

    // Verify no route metadata was set
    const routeMetadataCalls = (MetadataManager.setRouteMetadata as jest.Mock)
      .mock.calls;
    expect(routeMetadataCalls).toHaveLength(0);
  });

  it('should set method metadata with specific claims', () => {
    class TestController {
      @Protected([Claims.Profile, Claims.Email])
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

    // Verify no route metadata was set
    const routeMetadataCalls = (MetadataManager.setRouteMetadata as jest.Mock)
      .mock.calls;
    expect(routeMetadataCalls).toHaveLength(0);
  });

  it('should wrap the original method with session and claims checks', async () => {
    // Mock getClaims to simulate user having required claims
    const mockGetClaims = jest.fn().mockResolvedValue({ email: true });

    // Create a fake Client instance with the mocked getClaims
    const fakeClient = {
      getClaims: mockGetClaims,
    } as unknown as Client;

    // Create dummy request and response objects
    const req = {
      session: { user: { sub: '123' } },
    } as IRequest;
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as IResponse;

    let originalCalled = false;

    class TestController {
      client = fakeClient;

      @Protected([Claims.Email])
      async protectedMethod(_req: IRequest, _res: IResponse) {
        originalCalled = true;
      }
    }

    const controller = new TestController();

    // Manually invoke the decorated method
    await controller.protectedMethod(req, res);

    // Check that getClaims was called and the original method executed
    expect(mockGetClaims).toHaveBeenCalled();
    expect(originalCalled).toBe(true);
  });
});
