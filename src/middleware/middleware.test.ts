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
import { Claims, RouteAction } from '../enums';

jest.mock('../classes/Client');
jest.mock('../decorators/MetadataManager');

const createMockResponse = (init: Partial<IResponse> = {}): IResponse => {
  return {
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
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

  it('should handle errors and call onError if provided', async () => {
    const mockOnError = jest.fn();
    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Login,
      onError: mockOnError,
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAuthorizationUrl.mockRejectedValue(new Error('Auth Error'));

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(mockClient.getAuthorizationUrl).toHaveBeenCalled();
    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error), mockContext);
    expect(mockContext.response.status).not.toHaveBeenCalled();
    expect(mockContext.response.send).not.toHaveBeenCalled();
  });

  it('should handle errors and send 500 if onError not provided', async () => {
    const routeMetadata: IRouteMetadata = { action: RouteAction.Login };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAuthorizationUrl.mockRejectedValue(new Error('Auth Error'));

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(mockClient.getAuthorizationUrl).toHaveBeenCalled();
    expect(mockContext.response.status).toHaveBeenCalledWith(500);
    expect(mockContext.response.send).toHaveBeenCalledWith(
      'Authentication failed',
    );
  });

  // New Test Cases for Claims Validation

  it('should allow access if all required claims are present', async () => {
    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Protected,
      requiredClaims: [Claims.Email, Claims.Roles],
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAccessToken.mockResolvedValue('valid_token');
    mockClient.getClaims.mockResolvedValue({
      email: 'user@example.com',
      roles: ['admin', 'user'],
      sub: 'user1',
    });
    mockClient.getUserInfo.mockResolvedValue({ sub: 'user1' });

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(mockClient.getAccessToken).toHaveBeenCalled();
    expect(mockClient.getClaims).toHaveBeenCalled();
    expect(mockContext.user).toEqual({ sub: 'user1' });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should deny access and send 500 if required claims are missing', async () => {
    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Protected,
      requiredClaims: [Claims.Email, Claims.Roles],
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAccessToken.mockResolvedValue('valid_token');
    mockClient.getClaims.mockResolvedValue({
      email: 'user@example.com',
      // 'roles' claim is missing
      sub: 'user1',
    });

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(mockClient.getAccessToken).toHaveBeenCalled();
    expect(mockClient.getClaims).toHaveBeenCalled();
    expect(mockContext.user).toBeUndefined();
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockContext.response.redirect).not.toHaveBeenCalled();
    expect(mockContext.response.status).toHaveBeenCalledWith(500);
    expect(mockContext.response.send).toHaveBeenCalledWith(
      'Authentication failed',
    );
  });

  it('should allow access if no required claims are specified', async () => {
    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Protected,
      // No requiredClaims
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAccessToken.mockResolvedValue('valid_token');
    mockClient.getClaims.mockResolvedValue({
      email: 'user@example.com',
      roles: ['user'],
      sub: 'user1',
    });
    mockClient.getUserInfo.mockResolvedValue({ sub: 'user1' });

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(mockClient.getAccessToken).toHaveBeenCalled();
    expect(mockClient.getClaims).toHaveBeenCalled();
    expect(mockContext.user).toEqual({ sub: 'user1' });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle errors during claims retrieval and send 500', async () => {
    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Protected,
      requiredClaims: [Claims.Email],
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAccessToken.mockResolvedValue('valid_token');
    mockClient.getClaims.mockRejectedValue(
      new Error('Claims retrieval failed'),
    );

    const mw = middleware(mockClient);
    await mw(mockContext, mockNext);

    expect(mockClient.getAccessToken).toHaveBeenCalled();
    expect(mockClient.getClaims).toHaveBeenCalled();
    expect(mockContext.user).toBeUndefined();
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockContext.response.redirect).not.toHaveBeenCalled();
    expect(mockContext.response.status).toHaveBeenCalledWith(500);
    expect(mockContext.response.send).toHaveBeenCalledWith(
      'Authentication failed',
    );
  });

  it('should validate session successfully when session exists and matches state', async () => {
    // Setup the request with the correct URL containing code and state
    mockContext.request = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      {
        state: 'abc',
        codeVerifier: 'code_verifier_123',
      },
    );

    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getConfig = jest.fn().mockReturnValue({ session: true });
    mockClient.handleRedirect.mockResolvedValue(undefined);
    mockClient.getUserInfo.mockResolvedValue({ sub: 'user1' });

    const mwInstance = middleware(mockClient);
    await mwInstance(mockContext, mockNext);

    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      '123',
      'abc',
      'code_verifier_123',
      mockContext,
    );
    expect(mockContext.request.session?.user).toEqual({ sub: 'user1' });
    expect(mockContext.request.session?.state).toBeUndefined();
    expect(mockContext.request.session?.codeVerifier).toBeUndefined();
  });

  it('should throw ClientError if session is missing', async () => {
    // Setup the request without a session
    mockContext.request = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      undefined, // Session is missing
    );

    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getConfig = jest.fn().mockReturnValue({ session: true });

    const mwInstance = middleware(mockClient);
    await mwInstance(mockContext, mockNext);

    expect(mockClient.handleRedirect).not.toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockContext.response.status).toHaveBeenCalledWith(500);
    expect(mockContext.response.send).toHaveBeenCalledWith(
      'Authentication failed',
    );
  });

  it('should throw ClientError if state does not match', async () => {
    // Setup the request with mismatched state
    mockContext.request = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      {
        state: 'wrong_state',
        codeVerifier: 'code_verifier_123',
      },
    );

    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getConfig = jest.fn().mockReturnValue({ session: true });

    const mwInstance = middleware(mockClient);
    await mwInstance(mockContext, mockNext);

    expect(mockClient.handleRedirect).not.toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockContext.response.status).toHaveBeenCalledWith(500);
    expect(mockContext.response.send).toHaveBeenCalledWith(
      'Authentication failed',
    );
  });
  it('should throw ClientError if codeVerifier is missing', async () => {
    // Setup the request without codeVerifier
    mockContext.request = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      {
        state: 'abc',
        // codeVerifier is missing
      },
    );

    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getConfig = jest.fn().mockReturnValue({ session: true });

    const mwInstance = middleware(mockClient);
    await mwInstance(mockContext, mockNext);

    expect(mockClient.handleRedirect).not.toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockContext.response.status).toHaveBeenCalledWith(500);
    expect(mockContext.response.send).toHaveBeenCalledWith(
      'Authentication failed',
    );
  });
});
