// src/decorators/oidcCallback.test.ts

import { oidcCallback } from './oidcCallback';
import { Client } from '../classes/Client';
import { IStoreContext, IClientConfig } from '../interfaces';
import { StorageMechanism } from '../enums';

describe('oidcCallback', () => {
  let mockClient: jest.Mocked<Client>;
  let mockContext: IStoreContext;
  let mockRequest: any;
  let mockResponse: any;
  let oidcCallbackHandler: (context: IStoreContext) => Promise<void>;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Mock console.error to prevent actual logging during tests
    originalConsoleError = console.error;
    console.error = jest.fn();

    // Mock the Client methods used in oidcCallback
    mockClient = {
      getConfig: jest.fn(),
      handleRedirect: jest.fn(),
      getUserInfo: jest.fn(),
    } as unknown as jest.Mocked<Client>;

    // Initialize mock request and response
    mockRequest = {
      query: {},
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

    // Default implementation for getConfig (session enabled)
    mockClient.getConfig.mockReturnValue({
      // Provide a minimal session object as per IClientConfig
      session: {
        mechanism: StorageMechanism.MEMORY, // Assuming MEMORY is a valid enum value
        options: {}, // Provide empty options or mock as needed
      },
    } as IClientConfig);

    // Initialize the oidcCallback handler
    oidcCallbackHandler = oidcCallback(mockClient);
  });

  afterEach(() => {
    // Restore the original console.error after each test
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

  it('should redirect to the postLoginRedirectUri after successful authentication with session enabled', async () => {
    // Arrange
    const authorizationCode = 'authCode123';
    const state = 'state123';
    const authorizationUrl = 'https://auth.example.com/authorize';
    const userInfo = { sub: 'user123', name: 'John Doe' };

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Set up session data
    mockRequest.session.state = state;
    mockRequest.session.codeVerifier = 'codeVerifier123';

    // Mock client.handleRedirect and getUserInfo
    mockClient.handleRedirect.mockResolvedValue();
    mockClient.getUserInfo.mockResolvedValue(userInfo);

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      authorizationCode,
      state,
      'codeVerifier123',
      { request: mockRequest, response: mockResponse },
    );
    expect(mockClient.getUserInfo).toHaveBeenCalledTimes(1);
    expect(mockRequest.session.user).toEqual(userInfo);
    expect(mockRequest.session.state).toBeUndefined();
    expect(mockRequest.session.codeVerifier).toBeUndefined();
    expect(mockResponse.redirect).toHaveBeenCalledWith('/');
  });

  it('should redirect to the specified postLoginRedirectUri after successful authentication with session enabled', async () => {
    // Arrange
    const authorizationCode = 'authCode456';
    const state = 'state456';
    const postLoginRedirectUri = '/dashboard';
    const userInfo = { sub: 'user456', name: 'Jane Smith' };

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Set up session data
    mockRequest.session.state = state;
    mockRequest.session.codeVerifier = 'codeVerifier456';

    // Mock client.handleRedirect and getUserInfo
    mockClient.handleRedirect.mockResolvedValue();
    mockClient.getUserInfo.mockResolvedValue(userInfo);

    // Initialize the oidcCallback handler with postLoginRedirectUri option
    oidcCallbackHandler = oidcCallback(mockClient, { postLoginRedirectUri });

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      authorizationCode,
      state,
      'codeVerifier456',
      { request: mockRequest, response: mockResponse },
    );
    expect(mockClient.getUserInfo).toHaveBeenCalledTimes(1);
    expect(mockRequest.session.user).toEqual(userInfo);
    expect(mockRequest.session.state).toBeUndefined();
    expect(mockRequest.session.codeVerifier).toBeUndefined();
    expect(mockResponse.redirect).toHaveBeenCalledWith(postLoginRedirectUri);
  });

  it('should redirect to the postLoginRedirectUri after successful authentication with session disabled', async () => {
    // Arrange
    const authorizationCode = 'authCode789';
    const state = 'state789';
    const postLoginRedirectUri = '/home';
    const userInfo = { sub: 'user789', name: 'Alice Johnson' };

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Disable session by omitting the session property
    mockClient.getConfig.mockReturnValue({
      // session is undefined
    } as IClientConfig);

    // Re-initialize the handler with session disabled
    oidcCallbackHandler = oidcCallback(mockClient, { postLoginRedirectUri });

    // Mock client.handleRedirect and getUserInfo
    mockClient.handleRedirect.mockResolvedValue();
    mockClient.getUserInfo.mockResolvedValue(userInfo);

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      authorizationCode,
      state,
      null,
      { request: mockRequest, response: mockResponse },
    );
    expect(mockClient.getUserInfo).toHaveBeenCalledTimes(1);
    // Since session is disabled, user should not be set in session
    expect(mockRequest.session.user).toBeUndefined();
    expect(mockResponse.redirect).toHaveBeenCalledWith(postLoginRedirectUri);
  });

  it('should respond with 400 if code is missing', async () => {
    // Arrange
    const state = 'stateMissingCode';
    mockRequest.query.state = state;

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).not.toHaveBeenCalled(); // Updated
    expect(mockClient.handleRedirect).not.toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.send).toHaveBeenCalledWith(
      'Invalid callback parameters',
    );
  });

  it('should respond with 400 if state is missing', async () => {
    // Arrange
    const authorizationCode = 'authCodeMissingState';
    mockRequest.query.code = authorizationCode;

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).not.toHaveBeenCalled(); // Updated
    expect(mockClient.handleRedirect).not.toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.send).toHaveBeenCalledWith(
      'Invalid callback parameters',
    );
  });

  it('should respond with 400 if state does not match the stored state in session', async () => {
    // Arrange
    const authorizationCode = 'authCodeStateMismatch';
    const receivedState = 'receivedState';
    const storedState = 'storedState';

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = receivedState;

    // Set up session data with a different state
    mockRequest.session.state = storedState;
    mockRequest.session.codeVerifier = 'codeVerifierMismatch';

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).not.toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.send).toHaveBeenCalledWith('State mismatch');
  });

  it('should respond with 400 if codeVerifier is missing from session when session is enabled', async () => {
    // Arrange
    const authorizationCode = 'authCodeMissingVerifier';
    const state = 'stateMissingVerifier';

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Set up session data without codeVerifier
    mockRequest.session.state = state;
    // codeVerifier is undefined

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).not.toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.send).toHaveBeenCalledWith(
      'Code verifier missing from session',
    );
  });

  it('should call the custom onError handler when handleRedirect throws an error with session enabled', async () => {
    // Arrange
    const authorizationCode = 'authCodeHandleRedirectError';
    const state = 'stateHandleRedirectError';
    const codeVerifier = 'codeVerifierHandleRedirectError';
    const error = new Error('handleRedirect failed');

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Set up session data
    mockRequest.session.state = state;
    mockRequest.session.codeVerifier = codeVerifier;

    // Mock client.handleRedirect to throw an error
    mockClient.handleRedirect.mockRejectedValue(error);

    // Initialize the oidcCallback handler with onError option
    const onError = jest.fn();
    oidcCallbackHandler = oidcCallback(mockClient, { onError });

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      authorizationCode,
      state,
      codeVerifier,
      { request: mockRequest, response: mockResponse },
    );
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('OIDC Callback Error:', error);
    expect(onError).toHaveBeenCalledWith(error, mockContext);
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.send).not.toHaveBeenCalled();
  });

  it('should send a 500 response when handleRedirect throws an error and no onError handler is provided', async () => {
    // Arrange
    const authorizationCode = 'authCodeHandleRedirect500';
    const state = 'stateHandleRedirect500';
    const codeVerifier = 'codeVerifierHandleRedirect500';
    const error = new Error('handleRedirect failed');

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Set up session data
    mockRequest.session.state = state;
    mockRequest.session.codeVerifier = codeVerifier;

    // Mock client.handleRedirect to throw an error
    mockClient.handleRedirect.mockRejectedValue(error);

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      authorizationCode,
      state,
      codeVerifier,
      { request: mockRequest, response: mockResponse },
    );
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('OIDC Callback Error:', error);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith('Authentication failed');
  });

  it('should call the custom onError handler when getUserInfo throws an error with session enabled', async () => {
    // Arrange
    const authorizationCode = 'authCodeUserInfoError';
    const state = 'stateUserInfoError';
    const codeVerifier = 'codeVerifierUserInfoError';
    const userInfoError = new Error('getUserInfo failed');

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Set up session data
    mockRequest.session.state = state;
    mockRequest.session.codeVerifier = codeVerifier;

    // Mock client.handleRedirect to resolve successfully
    mockClient.handleRedirect.mockResolvedValue();

    // Mock client.getUserInfo to throw an error
    mockClient.getUserInfo.mockRejectedValue(userInfoError);

    // Initialize the oidcCallback handler with onError option
    const onError = jest.fn();
    oidcCallbackHandler = oidcCallback(mockClient, { onError });

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      authorizationCode,
      state,
      codeVerifier,
      { request: mockRequest, response: mockResponse },
    );
    expect(mockClient.getUserInfo).toHaveBeenCalledTimes(1);
    expect(mockRequest.session.user).toBeUndefined(); // user not set due to error
    expect(console.error).toHaveBeenCalledWith(
      'OIDC Callback Error:',
      userInfoError,
    );
    expect(onError).toHaveBeenCalledWith(userInfoError, mockContext);
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.send).not.toHaveBeenCalled();
  });

  it('should send a 500 response when getUserInfo throws an error and no onError handler is provided', async () => {
    // Arrange
    const authorizationCode = 'authCodeUserInfo500';
    const state = 'stateUserInfo500';
    const codeVerifier = 'codeVerifierUserInfo500';
    const userInfoError = new Error('getUserInfo failed');

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Set up session data
    mockRequest.session.state = state;
    mockRequest.session.codeVerifier = codeVerifier;

    // Mock client.handleRedirect to resolve successfully
    mockClient.handleRedirect.mockResolvedValue();

    // Mock client.getUserInfo to throw an error
    mockClient.getUserInfo.mockRejectedValue(userInfoError);

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      authorizationCode,
      state,
      codeVerifier,
      { request: mockRequest, response: mockResponse },
    );
    expect(mockClient.getUserInfo).toHaveBeenCalledTimes(1);
    expect(mockRequest.session.user).toBeUndefined(); // user not set due to error
    expect(console.error).toHaveBeenCalledWith(
      'OIDC Callback Error:',
      userInfoError,
    );
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith('Authentication failed');
  });

  it('should clean up state and codeVerifier from session after successful authentication', async () => {
    // Arrange
    const authorizationCode = 'authCodeCleanup';
    const state = 'stateCleanup';
    const codeVerifier = 'codeVerifierCleanup';
    const userInfo = { sub: 'userCleanup', name: 'Cleanup User' };

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Set up session data
    mockRequest.session.state = state;
    mockRequest.session.codeVerifier = codeVerifier;

    // Mock client.handleRedirect and getUserInfo
    mockClient.handleRedirect.mockResolvedValue();
    mockClient.getUserInfo.mockResolvedValue(userInfo);

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockRequest.session.state).toBeUndefined();
    expect(mockRequest.session.codeVerifier).toBeUndefined();
    expect(mockRequest.session.user).toEqual(userInfo);
  });

  it('should throw an error if request is missing', async () => {
    // Arrange
    const invalidContext: IStoreContext = {
      response: mockResponse,
    };

    // Act & Assert
    await expect(oidcCallbackHandler(invalidContext)).rejects.toThrow(
      'Request and Response objects are required in IStoreContext',
    );
    expect(mockClient.getConfig).not.toHaveBeenCalled();
    expect(mockClient.handleRedirect).not.toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockResponse.redirect).not.toHaveBeenCalled();
  });

  it('should throw an error if response is missing', async () => {
    // Arrange
    const invalidContext: IStoreContext = {
      request: mockRequest,
    };

    // Act & Assert
    await expect(oidcCallbackHandler(invalidContext)).rejects.toThrow(
      'Request and Response objects are required in IStoreContext',
    );
    expect(mockClient.getConfig).not.toHaveBeenCalled();
    expect(mockClient.handleRedirect).not.toHaveBeenCalled();
    expect(mockClient.getUserInfo).not.toHaveBeenCalled();
    expect(mockResponse.redirect).not.toHaveBeenCalled();
  });

  it('should handle callback without session correctly', async () => {
    // Arrange
    const authorizationCode = 'authCodeNoSession';
    const state = 'stateNoSession';
    const postLoginRedirectUri = '/no-session';
    const userInfo = { sub: 'userNoSession', name: 'No Session User' };

    // Set up request query parameters
    mockRequest.query.code = authorizationCode;
    mockRequest.query.state = state;

    // Disable session by omitting the session property
    mockClient.getConfig.mockReturnValue({
      // session is undefined
    } as IClientConfig);

    // Re-initialize the handler with postLoginRedirectUri option
    oidcCallbackHandler = oidcCallback(mockClient, { postLoginRedirectUri });

    // Mock client.handleRedirect and getUserInfo
    mockClient.handleRedirect.mockResolvedValue();
    mockClient.getUserInfo.mockResolvedValue(userInfo);

    // Act
    await oidcCallbackHandler(mockContext);

    // Assert
    expect(mockClient.getConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.handleRedirect).toHaveBeenCalledWith(
      authorizationCode,
      state,
      null,
      { request: mockRequest, response: mockResponse },
    );
    expect(mockClient.getUserInfo).toHaveBeenCalledTimes(1);
    expect(mockRequest.session.user).toBeUndefined(); // user not set since session is disabled
    expect(mockResponse.redirect).toHaveBeenCalledWith(postLoginRedirectUri);
  });
});
