// src/utils/Http.test.ts

import { Http } from './Http';
import { ILogger } from '../interfaces/ILogger';
import { IncomingMessage, ClientRequest } from 'http';
import { EventEmitter } from 'events';
import { ClientError } from '../errors/ClientError';

describe('HTTPClient', () => {
  let mockHttpLib: jest.Mock;
  let mockLogger: jest.Mocked<ILogger>;
  let httpClient: Http;

  beforeEach(() => {
    mockHttpLib = jest.fn();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    httpClient = new Http(mockLogger, mockHttpLib);
  });

  /**
   * Helper function to create a mocked ClientRequest.
   */
  const createMockClientRequest = (): ClientRequest => {
    return Object.assign(new EventEmitter(), {
      end: jest.fn(),
      write: jest.fn(),
    }) as unknown as ClientRequest;
  };

  /**
   * Helper function to create a mocked IncomingMessage with specified status and body.
   */
  const createMockIncomingMessage = (
    statusCode: number,
    body: string,
  ): IncomingMessage => {
    const mockRes = new EventEmitter() as IncomingMessage;
    mockRes.statusCode = statusCode;
    process.nextTick(() => {
      mockRes.emit('data', Buffer.from(body));
      mockRes.emit('end');
    });
    return mockRes;
  };

  it('should make a GET request successfully', async () => {
    const mockResponse = new EventEmitter() as IncomingMessage;
    mockResponse.statusCode = 200;

    // Extend EventEmitter to include 'end' method
    const mockReq = Object.assign(new EventEmitter(), {
      end: jest.fn(),
    }) as unknown as ClientRequest;

    mockHttpLib.mockImplementation((options, callback) => {
      process.nextTick(() => {
        callback(mockResponse);
        mockResponse.emit('data', Buffer.from('Success'));
        mockResponse.emit('end');
      });
      return mockReq;
    });

    const response = await httpClient.get('http://example.com');

    expect(mockHttpLib).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        hostname: 'example.com',
        port: 80,
        path: '/',
        headers: {},
      }),
      expect.any(Function),
    );
    expect(response).toBe('Success');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HTTP GET request to http://example.com succeeded',
      { statusCode: 200 },
    );
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle HTTP errors', async () => {
    const mockResponse = new EventEmitter() as IncomingMessage;
    mockResponse.statusCode = 404;

    const mockReq = Object.assign(new EventEmitter(), {
      end: jest.fn(),
    }) as unknown as ClientRequest;

    mockHttpLib.mockImplementation((options, callback) => {
      process.nextTick(() => {
        callback(mockResponse);
        mockResponse.emit('data', Buffer.from('Not Found'));
        mockResponse.emit('end');
      });
      return mockReq;
    });

    await expect(httpClient.get('http://example.com')).rejects.toThrow(
      ClientError,
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'HTTP GET request to http://example.com failed with status 404',
      { body: 'Not Found' },
    );
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle request errors', async () => {
    const mockReq = Object.assign(new EventEmitter(), {
      end: jest.fn(),
    }) as unknown as ClientRequest;

    mockHttpLib.mockImplementation(() => {
      process.nextTick(() => {
        mockReq.emit('error', new Error('Network Error'));
      });
      return mockReq;
    });

    await expect(httpClient.get('http://example.com')).rejects.toThrow(
      ClientError,
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'HTTP GET request to http://example.com encountered an error',
      new Error('Network Error'),
    );
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should make a POST request successfully with a body', async () => {
    const mockResponse = createMockIncomingMessage(201, 'Created');
    const mockReq = createMockClientRequest();

    mockHttpLib.mockImplementation((options, callback) => {
      process.nextTick(() => {
        callback(mockResponse);
        mockResponse.emit('data', Buffer.from('Created'));
        mockResponse.emit('end');
      });
      return mockReq;
    });

    const body = JSON.stringify({ key: 'value' });
    const response = await httpClient.post(
      'http://example.com/resource',
      body,
      { 'Content-Type': 'application/json' },
    );

    expect(mockHttpLib).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        hostname: 'example.com',
        port: 80,
        path: '/resource',
        headers: { 'Content-Type': 'application/json' },
      }),
      expect.any(Function),
    );
    expect(mockReq.write).toHaveBeenCalledWith(body);
    expect(response).toBe('Created');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HTTP POST request to http://example.com/resource succeeded',
      { statusCode: 201 },
    );
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle HTTP errors on POST requests', async () => {
    const mockResponse = createMockIncomingMessage(400, 'Bad Request');
    const mockReq = createMockClientRequest();

    mockHttpLib.mockImplementation((options, callback) => {
      process.nextTick(() => {
        callback(mockResponse);
        mockResponse.emit('data', Buffer.from('Bad Request'));
        mockResponse.emit('end');
      });
      return mockReq;
    });

    const body = JSON.stringify({ invalid: 'data' });

    await expect(
      httpClient.post('http://example.com/resource', body),
    ).rejects.toThrow(ClientError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'HTTP POST request to http://example.com/resource failed with status 400',
      { body: 'Bad Request' },
    );
    expect(mockReq.write).toHaveBeenCalledWith(body);
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle network errors on POST requests', async () => {
    const networkError = new Error('Network Failure');
    const mockReq = createMockClientRequest();

    mockHttpLib.mockImplementation(() => {
      process.nextTick(() => {
        mockReq.emit('error', networkError);
      });
      return mockReq;
    });

    const body = JSON.stringify({ key: 'value' });

    await expect(
      httpClient.post('http://example.com/resource', body),
    ).rejects.toThrow(ClientError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'HTTP POST request to http://example.com/resource encountered an error',
      networkError,
    );
    expect(mockReq.write).toHaveBeenCalledWith(body);
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should include custom headers in the request', async () => {
    const mockResponse = createMockIncomingMessage(200, 'OK');
    const mockReq = createMockClientRequest();

    mockHttpLib.mockImplementation((options, callback) => {
      process.nextTick(() => {
        callback(mockResponse);
        mockResponse.emit('data', Buffer.from('OK'));
        mockResponse.emit('end');
      });
      return mockReq;
    });

    const headers = {
      Authorization: 'Bearer token',
      'Custom-Header': 'CustomValue',
    };

    const response = await httpClient.get('http://example.com/data', headers);

    expect(mockHttpLib).toHaveBeenCalledWith(
      expect.objectContaining({
        headers,
      }),
      expect.any(Function),
    );
    expect(response).toBe('OK');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HTTP GET request to http://example.com/data succeeded',
      { statusCode: 200 },
    );
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle HTTPS requests correctly', async () => {
    const mockResponse = createMockIncomingMessage(200, 'Secure Success');
    const mockReq = createMockClientRequest();

    mockHttpLib.mockImplementation((options, callback) => {
      process.nextTick(() => {
        callback(mockResponse);
        mockResponse.emit('data', Buffer.from('Secure Success'));
        mockResponse.emit('end');
      });
      return mockReq;
    });

    const response = await httpClient.get('https://secure.example.com/secure');

    expect(mockHttpLib).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        hostname: 'secure.example.com',
        port: 443,
        path: '/secure',
        headers: {},
      }),
      expect.any(Function),
    );
    expect(response).toBe('Secure Success');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HTTP GET request to https://secure.example.com/secure succeeded',
      { statusCode: 200 },
    );
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should use a custom IHttpLibrary when provided', async () => {
    const customHttpLib = jest.fn();
    const customHttpClient = new Http(mockLogger, customHttpLib);

    const mockResponse = createMockIncomingMessage(
      200,
      'Custom Library Response',
    );
    const mockReq = createMockClientRequest();

    customHttpLib.mockImplementation((options, callback) => {
      process.nextTick(() => {
        callback(mockResponse);
        mockResponse.emit('data', Buffer.from('Custom Library Response'));
        mockResponse.emit('end');
      });
      return mockReq;
    });

    const response = await customHttpClient.get('http://custom.example.com');

    expect(customHttpLib).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        hostname: 'custom.example.com',
        port: 80,
        path: '/',
        headers: {},
      }),
      expect.any(Function),
    );
    expect(response).toBe('Custom Library Response');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HTTP GET request to http://custom.example.com succeeded',
      { statusCode: 200 },
    );
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle invalid URLs gracefully', async () => {
    const invalidUrl = 'ht!tp://invalid-url';

    await expect(httpClient.get(invalidUrl)).rejects.toThrow(ClientError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      `Failed to make HTTP GET request to ${invalidUrl}`,
      expect.objectContaining({
        message: 'Invalid URL',
      }),
    );
    expect(mockHttpLib).not.toHaveBeenCalled();
  });

  it('should make a PUT request successfully with a body', async () => {
    const mockResponse = createMockIncomingMessage(200, 'PUT Success');
    const mockReq = createMockClientRequest();

    mockHttpLib.mockImplementation((options, callback) => {
      process.nextTick(() => {
        callback(mockResponse);
        mockResponse.emit('data', Buffer.from('PUT Success'));
        mockResponse.emit('end');
      });
      return mockReq;
    });

    const body = JSON.stringify({ update: 'data' });
    const response = await httpClient.put('http://example.com/update', body);

    expect(mockHttpLib).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        hostname: 'example.com',
        port: 80,
        path: '/update',
        headers: {},
      }),
      expect.any(Function),
    );
    expect(mockReq.write).toHaveBeenCalledWith(body);
    expect(response).toBe('PUT Success');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HTTP PUT request to http://example.com/update succeeded',
      { statusCode: 200 },
    );
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle responses with empty body', async () => {
    const mockResponse = createMockIncomingMessage(204, '');
    const mockReq = createMockClientRequest();

    mockHttpLib.mockImplementation((options, callback) => {
      process.nextTick(() => {
        callback(mockResponse);
        mockResponse.emit('end');
      });
      return mockReq;
    });

    const response = await httpClient.get('http://example.com/no-content');

    expect(response).toBe('');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HTTP GET request to http://example.com/no-content succeeded',
      { statusCode: 204 },
    );
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle multiple simultaneous requests', async () => {
    const mockResponse1 = createMockIncomingMessage(200, 'Response 1');
    const mockResponse2 = createMockIncomingMessage(200, 'Response 2');
    const mockReq1 = createMockClientRequest();
    const mockReq2 = createMockClientRequest();

    mockHttpLib
      .mockImplementationOnce((options, callback) => {
        process.nextTick(() => {
          callback(mockResponse1);
          mockResponse1.emit('data', Buffer.from('Response 1'));
          mockResponse1.emit('end');
        });
        return mockReq1;
      })
      .mockImplementationOnce((options, callback) => {
        process.nextTick(() => {
          callback(mockResponse2);
          mockResponse2.emit('data', Buffer.from('Response 2'));
          mockResponse2.emit('end');
        });
        return mockReq2;
      });

    const promise1 = httpClient.get('http://example.com/1');
    const promise2 = httpClient.get('http://example.com/2');

    const [response1, response2] = await Promise.all([promise1, promise2]);

    expect(response1).toBe('Response 1');
    expect(response2).toBe('Response 2');
    expect(mockLogger.info).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HTTP GET request to http://example.com/1 succeeded',
      { statusCode: 200 },
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HTTP GET request to http://example.com/2 succeeded',
      { statusCode: 200 },
    );
    expect(mockReq1.end).toHaveBeenCalled();
    expect(mockReq2.end).toHaveBeenCalled();
  });
});
