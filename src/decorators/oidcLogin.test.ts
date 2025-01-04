// src/decorators/oidcLogin.test.ts

import { OidcLogin, OidcLoginOptions } from './oidcLogin';
import { Client } from '../classes/Client';
import { IStoreContext, IClientConfig } from '../interfaces';
import { StorageMechanism } from '../enums';
import { MetadataManager } from './MetadataManager';

describe('OidcLogin Decorator', () => {
  let mockClient: jest.Mocked<Client>;
  let mockContext: IStoreContext;
  let mockRequest: any;
  let mockResponse: any;
  let originalConsoleError: typeof console.error;

  // Define a mock class to apply the decorator
  class MockController {
    client: Client;

    constructor(client: Client) {
      this.client = client;
    }

    @OidcLogin()
    async loginHandler(req: any, res: any) {
      // Original method logic (if any)
      // For testing, we can leave this empty or add mock behavior
    }
  }

  beforeEach(() => {
    // Mock console.error to prevent actual logging during tests
    originalConsoleError = console.error;
    console.error = jest.fn();

    // Mock the Client methods used in oidcLogin
    mockClient = {
      getAuthorizationUrl: jest.fn(),
      getConfig: jest.fn(),
    } as unknown as jest.Mocked<Client>;

    // Initialize mock request and response
    mockRequest = {
      session: {},
    };

    mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    // Initialize the mock context with request and response
    mockContext = {
      request: mockRequest,
      response: mockResponse,
    };

    // Default implementation for getConfig
    mockClient.getConfig.mockReturnValue({
      session: {
        mechanism: StorageMechanism.MEMORY, // Assuming MEMORY is a valid enum value
        options: {}, // Provide empty options or mock as needed
      },
    } as IClientConfig);
  });

  afterEach(() => {
    // Restore the original console.error after each test
    console.error = originalConsoleError;
    jest.restoreAllMocks();
    MetadataManager.reset(); // Clear metadata between tests
  });

  /**
   * Helper function to create an instance of the mock controller
   * with the decorated method.
   */
  const createController = (options?: OidcLoginOptions) => {
    // Dynamically create a new class with the decorator applied with options
    class DynamicMockController {
      client: Client;

      constructor(client: Client) {
        this.client = client;
      }

      @OidcLogin(options)
      async loginHandler(req: any, res: any) {
        // Original method logic (if any)
      }
    }

    return new DynamicMockController(mockClient);
  };

  it('should redirect to the authorization URL and set session state and codeVerifier when session is enabled', async () => {
    // Arrange
    const authorizationUrl = 'https://auth.example.com/authorize';
    const state = 'randomState123';
    const codeVerifier = 'randomCodeVerifier123';

    mockClient.getAuthorizationUrl.mockResolvedValue({
      url: authorizationUrl,
      state,
      codeVerifier,
    });

    const controller = createController();

    // Act
    await controller.loginHandler(mockRequest, mockResponse);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeDefined();
    expect(mockRequest.session.state).toHaveProperty(state);
    expect(mockRequest.session.state[state].codeVerifier).toBe(codeVerifier);
    expect(typeof mockRequest.session.state[state].createdAt).toBe('number');
    expect(mockResponse.redirect).toHaveBeenCalledWith(authorizationUrl);
  });

  it('should redirect to the authorization URL and set only session state when codeVerifier is null', async () => {
    // Arrange
    const authorizationUrl = 'https://auth.example.com/authorize';
    const state = 'randomState123';
    const codeVerifier = null; // Explicitly set to null

    mockClient.getAuthorizationUrl.mockResolvedValue({
      url: authorizationUrl,
      state,
      codeVerifier,
    });

    const controller = createController();

    // Act
    await controller.loginHandler(mockRequest, mockResponse);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeDefined();
    expect(mockRequest.session.state).toHaveProperty(state);
    expect(mockRequest.session.state[state].codeVerifier).toBeNull();
    expect(typeof mockRequest.session.state[state].createdAt).toBe('number');
    expect(mockResponse.redirect).toHaveBeenCalledWith(authorizationUrl);
  });

  it('should initialize session if it is not already present', async () => {
    // Arrange
    delete mockRequest.session; // Remove existing session
    const authorizationUrl = 'https://auth.example.com/authorize';
    const state = 'randomState123';
    const codeVerifier = 'randomCodeVerifier123';

    mockClient.getAuthorizationUrl.mockResolvedValue({
      url: authorizationUrl,
      state,
      codeVerifier,
    });

    const controller = createController();

    // Act
    await controller.loginHandler(mockRequest, mockResponse);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeDefined();
    expect(mockRequest.session.state).toHaveProperty(state);
    expect(mockRequest.session.state[state].codeVerifier).toBe(codeVerifier);
    expect(typeof mockRequest.session.state[state].createdAt).toBe('number');
    expect(mockResponse.redirect).toHaveBeenCalledWith(authorizationUrl);
  });

  it('should redirect to the authorization URL without modifying session when session is disabled', async () => {
    // Arrange
    mockClient.getConfig.mockReturnValue({
      // Omit the session property to disable session
      session: undefined,
    } as IClientConfig);

    const controller = createController();

    // Initialize mockRequest without session
    mockRequest.session = undefined;

    const authorizationUrl = 'https://auth.example.com/authorize';
    const state = 'randomState123';
    const codeVerifier = 'randomCodeVerifier123';

    mockClient.getAuthorizationUrl.mockResolvedValue({
      url: authorizationUrl,
      state,
      codeVerifier,
    });

    // Act
    await controller.loginHandler(mockRequest, mockResponse);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeUndefined(); // Adjusted expectation
    expect(mockResponse.redirect).toHaveBeenCalledWith(authorizationUrl);
  });

  it('should call the custom onError handler when getAuthorizationUrl throws an error', async () => {
    // Arrange
    const error = new Error('Authorization URL fetch failed');
    mockClient.getAuthorizationUrl.mockRejectedValue(error);

    const onError = jest.fn();

    const controller = createController({ onError });

    // Act
    await controller.loginHandler(mockRequest, mockResponse);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('OIDC Login Error:', error);
    expect(onError).toHaveBeenCalledWith(error, mockContext);
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.send).not.toHaveBeenCalled();
  });

  it('should send a 500 response when getAuthorizationUrl throws an error and no onError handler is provided', async () => {
    // Arrange
    const error = new Error('Authorization URL fetch failed');
    mockClient.getAuthorizationUrl.mockRejectedValue(error);

    const controller = createController(); // No onError provided

    // Act
    await controller.loginHandler(mockRequest, mockResponse);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('OIDC Login Error:', error);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith(
      'Authentication initiation failed',
    );
  });

  it('should not set codeVerifier in session if it is not provided (set to null)', async () => {
    // Arrange
    const authorizationUrl = 'https://auth.example.com/authorize';
    const state = 'randomState123';
    const codeVerifier = null; // Explicitly set to null

    mockClient.getAuthorizationUrl.mockResolvedValue({
      url: authorizationUrl,
      state,
      codeVerifier,
    });

    const controller = createController();

    // Act
    await controller.loginHandler(mockRequest, mockResponse);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeDefined();
    expect(mockRequest.session.state).toHaveProperty(state);
    expect(mockRequest.session.state[state].codeVerifier).toBeNull(); // Adjusted expectation
    expect(typeof mockRequest.session.state[state].createdAt).toBe('number');
    expect(mockResponse.redirect).toHaveBeenCalledWith(authorizationUrl);
  });
  it('should attach metadata indicating this method is an OIDC login handler', () => {
    // Arrange
    const controller = createController();
    const metadata = MetadataManager.getMethodMetadata(
      controller.constructor,
      'loginHandler',
    );

    // Assert
    expect(metadata).toBeDefined();
    expect(metadata.isOidcLogin).toBe(true);
  });
});
