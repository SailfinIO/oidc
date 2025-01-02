import { middleware } from './middleware';
import { Client } from '../classes/Client';
import { MetadataManager } from '../decorators/MetadataManager';
import {
  IStoreContext,
  IRouteMetadata,
  IResponse,
  ISessionData,
  IRequest,
} from '../interfaces';
import { RouteAction, Scopes } from '../enums';
import { ClientError } from '../errors/ClientError';

jest.mock('../classes/Client');
jest.mock('../decorators/MetadataManager');

const createMockResponse = (init: Partial<IResponse> = {}): IResponse => {
  return {
    // Mock the redirect method
    redirect: jest.fn(),

    // Mock the status method
    status: jest.fn().mockReturnThis(),

    // Mock the send method
    send: jest.fn().mockReturnThis(),

    // Additional properties if needed
    headers: new Headers(),
    body: null,
    bodyUsed: false,
    ok: true,
    redirected: false,
    statusText: 'OK',
    type: 'basic',
    url: 'http://localhost',
    clone: jest.fn(),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    blob: jest.fn().mockResolvedValue(new Blob()),
    formData: jest.fn().mockResolvedValue(new FormData()),
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(''),
  } as unknown as IResponse;
};

const createMockRequest = (
  url: string = 'http://localhost',
  init: RequestInit = {},
  query: Record<string, any> = {},
  session?: ISessionData,
): IRequest => {
  const request = new Request(url, init) as IRequest;
  request.query = query;
  if (session) {
    request.session = session;
  }
  return request;
};

describe('OIDC Middleware', () => {
  let mockClient: jest.Mocked<Client>;
  let mockContext: IStoreContext;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockClient = {
      getConfig: jest.fn(),
      handleRedirect: jest.fn(),
      getUserInfo: jest.fn(),
      getAuthorizationUrl: jest.fn(),
      getAccessToken: jest.fn(),
      getClaims: jest.fn(),
    } as unknown as jest.Mocked<Client>;

    const mockRequest = createMockRequest('http://localhost', {
      headers: {
        cookie: 'sid=mock_sid',
      },
    });

    const mockResponse = createMockResponse();

    // Initialize the mock context with request and response
    mockContext = {
      request: mockRequest,
      response: mockResponse,
    };

    mockNext = jest.fn().mockResolvedValue(undefined);
    MetadataManager.getRouteMetadata = jest.fn();
  });

  it('should call next if no request or response', async () => {
    const mw = middleware(mockClient);
    await mw({}, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should call next if no route metadata', async () => {
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(null);
    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle login action', async () => {
    const routeMetadata: IRouteMetadata = { action: RouteAction.Login };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAuthorizationUrl.mockResolvedValue({
      url: 'http://auth.url',
      state: 'abc',
      codeVerifier: '123',
    });

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(mockClient.getAuthorizationUrl).toHaveBeenCalled();
    expect(mockContext.response.redirect).toHaveBeenCalledWith(
      'http://auth.url',
    );
  });

  it('should handle callback action', async () => {
    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockContext.request = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      mockContext.request.session,
    );
    mockClient.getConfig = jest.fn().mockReturnValue({ session: false });
    mockClient.handleRedirect.mockResolvedValue(undefined);
    mockClient.getUserInfo.mockResolvedValue({ sub: 'user1' });

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      '123',
      'abc',
      null,
      mockContext,
    );
    expect(mockClient.getUserInfo).toHaveBeenCalled();
    expect(mockContext.response.redirect).toHaveBeenCalledWith('/dashboard');
  });

  // it('should handle protected action with valid token', async () => {
  //   const routeMetadata: IRouteMetadata = {
  //     action: RouteAction.Protected,
  //     requiredScopes: [Scopes.Email],
  //   };
  //   (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
  //     routeMetadata,
  //   );
  //   mockClient.getAccessToken.mockResolvedValue('token');
  //   mockClient.getClaims.mockResolvedValue({ scope: 'read write' });
  //   mockClient.getUserInfo.mockResolvedValue({ sub: 'user1' });

  //   const mw = middleware(mockClient);
  //   await mw(mockContext, mockNext);

  //   expect(mockClient.getAccessToken).toHaveBeenCalled();
  //   expect(mockClient.getClaims).toHaveBeenCalled();
  //   expect(mockClient.getUserInfo).toHaveBeenCalled();
  //   expect(mockNext).toHaveBeenCalled();
  //   expect(mockContext.user).toEqual({ id: 'user1' });
  // });

  // it('should redirect to auth if no access token in protected action', async () => {
  //   const routeMetadata: IRouteMetadata = {
  //     action: RouteAction.Protected,
  //     requiredScopes: [Scopes.Admin],
  //   };
  //   (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
  //     routeMetadata,
  //   );
  //   mockClient.getAccessToken.mockResolvedValue(null);
  //   mockClient.getAuthorizationUrl.mockResolvedValue({
  //     url: 'http://auth.url',
  //     state: 'abc',
  //     codeVerifier: '123',
  //   });

  //   const mw = middleware(mockClient);
  //   await mw(mockContext, mockNext);

  //   expect(mockClient.getAccessToken).toHaveBeenCalled();
  //   expect(mockClient.getAuthorizationUrl).toHaveBeenCalled();
  //   expect(mockContext.response.redirect).toHaveBeenCalledWith(
  //     'http://auth.url',
  //   );
  //   expect(mockNext).not.toHaveBeenCalled();
  // });

  // it('should handle insufficient scopes', async () => {
  //   const routeMetadata: IRouteMetadata = {
  //     action: RouteAction.Protected,
  //     requiredScopes: [Scopes.Admin],
  //   };
  //   (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
  //     routeMetadata,
  //   );
  //   mockClient.getAccessToken.mockResolvedValue('token');
  //   mockClient.getClaims.mockResolvedValue({ scope: 'read' });

  //   const mw = middleware(mockClient);

  //   await expect(mw(mockContext, mockNext)).rejects.toThrow(
  //     new ClientError('Insufficient scopes', 'INSUFFICIENT_SCOPES'),
  //   );

  //   expect(mockClient.getAccessToken).toHaveBeenCalled();
  //   expect(mockClient.getClaims).toHaveBeenCalled();
  //   expect(mockNext).not.toHaveBeenCalled();
  // });

  it('should handle errors and call onError if provided', async () => {
    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Login,
      onError: jest.fn(),
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAuthorizationUrl.mockRejectedValue(new Error('Auth Error'));

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(routeMetadata.onError).toHaveBeenCalled();
    expect(mockContext.response.status).not.toHaveBeenCalled();
  });

  it('should handle errors and send 500 if onError not provided', async () => {
    const routeMetadata: IRouteMetadata = { action: RouteAction.Login };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAuthorizationUrl.mockRejectedValue(new Error('Auth Error'));

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(mockContext.response.status).toHaveBeenCalledWith(500);
    expect(mockContext.response.send).toHaveBeenCalledWith(
      'Authentication failed',
    );
  });
});
