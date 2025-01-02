// src/decorators/oidcLogin.test.ts

import { oidcLogin, OidcLoginOptions } from './oidcLogin';
import { Client } from '../classes/Client';
import { IStoreContext, IClientConfig } from '../interfaces';
import { StorageMechanism } from '../enums';

describe('oidcLogin', () => {
  let mockClient: jest.Mocked<Client>;
  let mockContext: IStoreContext;
  let mockRequest: any;
  let mockResponse: any;
  let oidcLoginHandler: (context: IStoreContext) => Promise<void>;
  let originalConsoleError: typeof console.error;

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
      // Provide a minimal session object as per IClientConfig
      session: {
        mechanism: StorageMechanism.MEMORY, // Assuming MEMORY is a valid enum value
        options: {}, // Provide empty options or mock as needed
      },
    } as IClientConfig);

    // Initialize the oidcLogin handler
    oidcLoginHandler = oidcLogin(mockClient);
  });

  afterEach(() => {
    // Restore the original console.error after each test
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

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

    // Act
    await oidcLoginHandler(mockContext);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeDefined();
    expect(mockRequest.session.state).toBe(state);
    expect(mockRequest.session.codeVerifier).toBe(codeVerifier);
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

    // Act
    await oidcLoginHandler(mockContext);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeDefined();
    expect(mockRequest.session.state).toBe(state);
    expect(mockRequest.session.codeVerifier).toBeUndefined(); // Adjusted expectation
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

    // Act
    await oidcLoginHandler(mockContext);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeDefined();
    expect(mockRequest.session.state).toBe(state);
    expect(mockRequest.session.codeVerifier).toBe(codeVerifier);
    expect(mockResponse.redirect).toHaveBeenCalledWith(authorizationUrl);
  });

  it('should redirect to the authorization URL without modifying session when session is disabled', async () => {
    // Arrange
    mockClient.getConfig.mockReturnValue({
      // Omit the session property to disable session
    } as IClientConfig);

    // Re-initialize the handler with session disabled
    oidcLoginHandler = oidcLogin(mockClient);

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
    await oidcLoginHandler(mockContext);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeUndefined(); // Adjusted expectation
    expect(mockResponse.redirect).toHaveBeenCalledWith(authorizationUrl);
  });

  it('should throw an error if request is missing', async () => {
    // Arrange
    const invalidContext: IStoreContext = {
      response: mockResponse,
    };

    // Act & Assert
    await expect(oidcLoginHandler(invalidContext)).rejects.toThrow(
      'Request and Response objects are required in IStoreContext',
    );
    expect(mockClient.getAuthorizationUrl).not.toHaveBeenCalled();
    expect(mockResponse.redirect).not.toHaveBeenCalled();
  });

  it('should throw an error if response is missing', async () => {
    // Arrange
    const invalidContext: IStoreContext = {
      request: mockRequest,
    };

    // Act & Assert
    await expect(oidcLoginHandler(invalidContext)).rejects.toThrow(
      'Request and Response objects are required in IStoreContext',
    );
    expect(mockClient.getAuthorizationUrl).not.toHaveBeenCalled();
    expect(mockResponse.redirect).not.toHaveBeenCalled();
  });

  it('should call the custom onError handler when getAuthorizationUrl throws an error', async () => {
    // Arrange
    const error = new Error('Authorization URL fetch failed');
    mockClient.getAuthorizationUrl.mockRejectedValue(error);

    const onError = jest.fn();

    // Re-initialize the handler with onError option
    oidcLoginHandler = oidcLogin(mockClient, { onError });

    // Act
    await oidcLoginHandler(mockContext);

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

    // Act
    await oidcLoginHandler(mockContext);

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

    // Act
    await oidcLoginHandler(mockContext);

    // Assert
    expect(mockClient.getAuthorizationUrl).toHaveBeenCalledTimes(1);
    expect(mockRequest.session).toBeDefined();
    expect(mockRequest.session.state).toBe(state);
    expect(mockRequest.session.codeVerifier).toBeUndefined(); // Adjusted expectation
    expect(mockResponse.redirect).toHaveBeenCalledWith(authorizationUrl);
  });
});
