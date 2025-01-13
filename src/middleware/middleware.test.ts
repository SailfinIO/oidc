// src/middleware/middleware.test.ts

import { middleware } from './middleware';
import { Client } from '../classes/Client';
import { MetadataManager } from '../decorators/MetadataManager';
import {
  IRouteMetadata,
  IResponse,
  ISessionData,
  IRequest,
  ISessionStore,
  CookieOptions,
  IClientConfig,
  IStoreContext,
} from '../interfaces';
import {
  Claims,
  RouteAction,
  SameSite,
  SessionMode,
  StorageMechanism,
} from '../enums';
import { ClientError } from '../errors';

jest.mock('../classes/Client');
jest.mock('../decorators/MetadataManager');

const createMockResponse = (init: Partial<IResponse> = {}): IResponse => {
  const headers = new Headers(init.headers);
  let redirected = false;

  return {
    redirect: jest.fn().mockImplementation((url: string) => {
      redirected = true;
      headers.append('Location', url);
      // You can add more logic here if needed
    }),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    headers,
    get redirected() {
      return redirected;
    },
    set redirected(value: boolean) {
      redirected = value;
    },
    body: null,
    bodyUsed: false,
    ok: true,
    statusText: 'OK',
    type: 'basic',
    url: 'http://localhost',
    clone: jest.fn(),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    blob: jest.fn().mockResolvedValue(new Blob()),
    formData: jest.fn().mockResolvedValue(new FormData()),
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(''),
    ...init,
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
  request.session = session || {};
  // Mock headers.get('host')
  Object.defineProperty(request.headers, 'get', {
    value: jest.fn((header: string) => {
      if (header.toLowerCase() === 'host') return 'localhost';
      return null;
    }),
  });
  return request;
};

const mockSessionStore: ISessionStore = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  destroy: jest.fn().mockResolvedValue(undefined),
  touch: jest.fn().mockResolvedValue(undefined),
};

const mockCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: SameSite.LAX,
};

const mockConfig: IClientConfig = {
  clientId: 'your-client-id',
  redirectUri: 'http://localhost/callback',
  scopes: ['openid', 'profile', 'email'],
  discoveryUrl: 'http://localhost/.well-known/openid-configuration',
  session: {
    mode: SessionMode.SERVER,
    store: mockSessionStore,
    cookie: {
      name: 'session_cookie',
      secret: 'supersecretkey',
      options: mockCookieOptions,
    },
    useSilentRenew: false,
    ttl: 3600,
  },
};

describe('OIDC Middleware', () => {
  let mockClient: jest.Mocked<Client>;
  let mockRequest: IRequest;
  let mockResponse: IResponse;
  let mockNext: jest.Mock;
  let capturedContext: IStoreContext | null = null;

  beforeEach(() => {
    mockClient = {
      getConfig: jest.fn(),
      handleRedirect: jest.fn(),
      getUserInfo: jest.fn(),
      getAuthorizationUrl: jest.fn(),
      getAccessToken: jest.fn(),
      getClaims: jest.fn(),
      getLogger: jest.fn().mockReturnValue({
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
      getSessionStore: jest.fn().mockReturnValue(mockSessionStore),
    } as unknown as jest.Mocked<Client>;

    mockClient.getConfig.mockReturnValue(mockConfig);

    mockRequest = createMockRequest('http://localhost', {
      headers: {
        // Headers are mocked below
        cookie: 'sid=mock_sid',
      },
    });

    mockResponse = createMockResponse();

    mockNext = jest.fn().mockResolvedValue(undefined);
    MetadataManager.getRouteMetadata = jest.fn();

    // Capture context in handleRedirect
    mockClient.handleRedirect.mockImplementation(
      async (code, state, context) => {
        console.log('Before handleRedirect:', context.user); // Should log undefined
        capturedContext = {
          request: context.request,
          response: context.response,
          extra: { ...context.extra },
          user: context.user,
        };
        if (context.request.session && context.request.session.state) {
          delete context.request.session.state[state];
        }
        console.log('After handleRedirect:', context.user); // Should still log undefined
      },
    );
  });

  afterEach(() => {
    capturedContext = null;
    jest.resetAllMocks();
  });

  it('should call next if no request or response', async () => {
    const mw = middleware(mockClient);
    await mw(
      undefined as unknown as IRequest,
      undefined as unknown as IResponse,
      mockNext,
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should call next if no route metadata', async () => {
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(null);
    const mw = middleware(mockClient);
    await mw(mockRequest, mockResponse, mockNext);
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
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.getAuthorizationUrl).toHaveBeenCalled();
    expect(mockResponse.redirect).toHaveBeenCalledWith('http://auth.url');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle callback action', async () => {
    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );

    const initialSession: ISessionData = {
      state: {
        abc: {
          codeVerifier: 'code_verifier_123',
          createdAt: Date.now(),
        },
      },
      user: undefined,
      cookie: undefined,
    };

    mockRequest = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      initialSession,
    );

    mockClient.getConfig.mockReturnValue(mockConfig);
    mockClient.getUserInfo.mockResolvedValue({ sub: 'user1' });

    // Modify the handleRedirect mock to include assertions
    mockClient.handleRedirect.mockImplementation(
      async (code, state, context) => {
        // Assert that context.user is undefined at the time of handleRedirect
        expect(context.user).toBeUndefined();

        // Optionally, you can capture other parts of context if needed
        expect(context.request).toBe(mockRequest);
        expect(context.response).toBe(mockResponse);
        expect(context.extra).toEqual({});

        // Simulate any necessary behavior within handleRedirect
        if (context.request.session && context.request.session.state) {
          delete context.request.session.state[state];
        }
      },
    );

    const mw = middleware(mockClient);
    await mw(mockRequest, mockResponse, mockNext);

    // Verify handleRedirect was called correctly with 3 arguments
    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      '123',
      'abc',
      expect.any(Object),
    );

    // Verify getUserInfo was called
    expect(mockClient.getUserInfo).toHaveBeenCalled();

    // Verify session was updated with user info
    expect(mockRequest.session?.user).toEqual({ sub: 'user1' });

    // Verify state was removed from session
    expect(mockRequest.session?.state).toEqual({});

    // Verify redirection after successful callback handling
    expect(mockResponse.redirect).toHaveBeenCalledWith('/dashboard');

    // Ensure next was not called
    expect(mockNext).not.toHaveBeenCalled();
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
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.getAuthorizationUrl).toHaveBeenCalled();
    expect(mockOnError).toHaveBeenCalledWith(
      expect.any(Error),
      mockRequest,
      mockResponse,
    );
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.send).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle errors and send 500 if onError not provided', async () => {
    const routeMetadata: IRouteMetadata = { action: RouteAction.Login };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getAuthorizationUrl.mockRejectedValue(new Error('Auth Error'));

    const mw = middleware(mockClient);
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.getAuthorizationUrl).toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith('Authentication failed');
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
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
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.getAccessToken).toHaveBeenCalled();
    expect(mockClient.getClaims).toHaveBeenCalled();
    expect(mockClient.getUserInfo).toHaveBeenCalled();
    expect(mockRequest.session?.user).toEqual({ sub: 'user1' });
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
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.getAccessToken).toHaveBeenCalled();
    expect(mockClient.getClaims).toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockRequest.session?.user).toBeUndefined();
    expect(mockNext).toHaveBeenCalledWith(expect.any(ClientError));
    expect(mockResponse.redirect).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith('Authentication failed');
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
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.getAccessToken).toHaveBeenCalled();
    expect(mockClient.getClaims).toHaveBeenCalled();
    expect(mockClient.getUserInfo).toHaveBeenCalled();
    expect(mockRequest.session?.user).toEqual({ sub: 'user1' });
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
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.getAccessToken).toHaveBeenCalled();
    expect(mockClient.getClaims).toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockRequest.session?.user).toBeUndefined();
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    expect(mockResponse.redirect).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith('Authentication failed');
  });

  it('should validate session successfully when session exists and matches state', async () => {
    // Setup the request with the correct URL containing code and state
    const initialSession: ISessionData = {
      state: {
        abc: {
          codeVerifier: 'code_verifier_123',
          createdAt: Date.now(),
        },
      },
      user: undefined,
      cookie: undefined,
    };
    mockRequest = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      initialSession,
    );

    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );
    mockClient.getConfig.mockReturnValue(mockConfig);
    mockClient.handleRedirect.mockImplementation(
      async (code, state, context) => {
        if (context.request && context.request.session) {
          context.request.session.state = undefined;
        }
      },
    );
    mockClient.getUserInfo.mockResolvedValue({ sub: 'user1' });

    const mw = middleware(mockClient);
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      '123',
      'abc',
      expect.any(Object),
    );
    expect(mockClient.getUserInfo).toHaveBeenCalled();
    expect(mockRequest.session?.user).toEqual({ sub: 'user1' });
    expect(mockRequest.session?.state).toBeUndefined();
    expect(mockResponse.redirect).toHaveBeenCalledWith('/dashboard');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw ClientError if session is missing', async () => {
    // Setup the request without a session
    mockRequest = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      undefined, // Session is missing
    );
    mockClient.getConfig.mockReturnValue(mockConfig);

    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );

    // Make handleRedirect throw an error due to missing session data
    mockClient.handleRedirect.mockImplementation(
      async (code, state, context) => {
        throw new ClientError('Missing session data', 'MISSING_SESSION');
      },
    );

    const mw = middleware(mockClient);
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      '123',
      'abc',
      expect.any(Object),
    );
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith('Authentication failed');
    expect(mockNext).toHaveBeenCalledWith(expect.any(ClientError));
  });

  it('should throw ClientError if state does not match', async () => {
    // Setup the request with mismatched state
    const initialSession: ISessionData = {
      state: {
        wrong_state: {
          codeVerifier: 'code_verifier_123',
          createdAt: Date.now(),
        },
      },
      user: undefined,
      cookie: undefined,
    };
    mockRequest = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      initialSession,
    );
    mockClient.getConfig.mockReturnValue(mockConfig);

    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );

    // Make handleRedirect throw an error due to state mismatch
    mockClient.handleRedirect.mockImplementation(
      async (code, state, context) => {
        const sessionState = context.request.session.state;
        if (!sessionState || !sessionState[state]) {
          throw new ClientError('State mismatch', 'STATE_MISMATCH');
        }
      },
    );

    const mw = middleware(mockClient);
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      '123',
      'abc',
      expect.any(Object),
    );
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith('Authentication failed');
    expect(mockNext).toHaveBeenCalledWith(expect.any(ClientError));
  });

  it('should throw ClientError if codeVerifier is missing', async () => {
    // Setup the request without codeVerifier
    const initialSession: ISessionData = {
      state: {
        abc: {
          // codeVerifier is missing
          createdAt: Date.now(),
        },
      },
      user: undefined,
      cookie: undefined,
    };

    mockRequest = createMockRequest(
      'http://localhost/callback?code=123&state=abc',
      {
        headers: {
          cookie: 'sid=mock_sid',
        },
      },
      {},
      initialSession,
    );
    mockClient.getConfig.mockReturnValue(mockConfig);

    const routeMetadata: IRouteMetadata = {
      action: RouteAction.Callback,
      postLoginRedirectUri: '/dashboard',
    };
    (MetadataManager.getRouteMetadata as jest.Mock).mockReturnValue(
      routeMetadata,
    );

    // Make handleRedirect throw an error due to missing codeVerifier
    mockClient.handleRedirect.mockImplementation(
      async (code, state, context) => {
        const sessionState = context.request.session.state;
        if (
          !sessionState ||
          !sessionState[state] ||
          !sessionState[state].codeVerifier
        ) {
          throw new ClientError(
            'Missing codeVerifier',
            'MISSING_CODE_VERIFIER',
          );
        }
      },
    );

    const mw = middleware(mockClient);
    await mw(mockRequest, mockResponse, mockNext);

    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      '123',
      'abc',
      expect.any(Object),
    );
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith('Authentication failed');
    expect(mockNext).toHaveBeenCalledWith(expect.any(ClientError));
  });
});
