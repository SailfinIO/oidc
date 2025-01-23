import { Response } from './Response';
import { ContentType, StatusCode } from '../enums';
import { IResponse } from '../interfaces';
import { ServerResponse } from 'http';

// Mock implementation for ServerResponse
const createMockServerResponse = () => {
  const mockSetHeader = jest.fn();
  const mockGetHeader = jest.fn();
  const mockRemoveHeader = jest.fn();
  const mockEnd = jest.fn();
  const mockWriteHead = jest.fn();

  const mockRes: Partial<ServerResponse> = {
    setHeader: mockSetHeader,
    getHeader: mockGetHeader,
    removeHeader: mockRemoveHeader,
    end: mockEnd,
    writeHead: mockWriteHead,
    headersSent: false,
    statusCode: StatusCode.OK,
  };

  return {
    mockRes,
    mockSetHeader,
    mockGetHeader,
    mockRemoveHeader,
    mockEnd,
    mockWriteHead,
  };
};

describe('Response', () => {
  let response: IResponse;
  let mockRes: Partial<ServerResponse>;
  let mockSetHeader: jest.Mock;
  let mockGetHeader: jest.Mock;
  let mockRemoveHeader: jest.Mock;
  let mockEnd: jest.Mock;
  let mockWriteHead: jest.Mock;

  beforeEach(() => {
    const mocks = createMockServerResponse();
    mockRes = mocks.mockRes;
    mockSetHeader = mocks.mockSetHeader;
    mockGetHeader = mocks.mockGetHeader;
    mockRemoveHeader = mocks.mockRemoveHeader;
    mockEnd = mocks.mockEnd;
    mockWriteHead = mocks.mockWriteHead;

    response = new Response(mockRes as ServerResponse);
  });

  test('should initialize with default values', () => {
    expect(response.body).toBeNull();
    expect(response.headers.size).toBe(0);
    expect(response.cookies.size).toBe(0);
    expect(response.getStatus()).toBe(StatusCode.OK);
    expect(response.headersSent).toBe(false);
  });

  test('should set status code', () => {
    response.status(StatusCode.CREATED);
    expect(response.getStatus()).toBe(StatusCode.CREATED);
    expect(mockRes.statusCode).toBe(StatusCode.CREATED);
  });

  test('should send JSON body', () => {
    const data = { message: 'Hello, world!' };
    response.json(data);

    expect(response.body).toBe(JSON.stringify(data));
    expect(response.getHeader('Content-Type')).toBe(ContentType.JSON);

    // Verify that setHeader was called correctly
    expect(mockSetHeader).toHaveBeenCalledWith(
      'Content-Type',
      ContentType.JSON,
    );

    // Verify that end was called with the correct body
    expect(mockEnd).toHaveBeenCalledWith(JSON.stringify(data));

    // Verify that statusCode was set
    expect(mockRes.statusCode).toBe(StatusCode.OK);
  });

  test('should set and get headers', () => {
    response.setHeader('X-Custom-Header', 'value');
    expect(response.getHeader('X-Custom-Header')).toBe('value');

    // Verify that setHeader was called on ServerResponse
    expect(mockSetHeader).toHaveBeenCalledWith('X-Custom-Header', 'value');
  });

  test('should remove headers', () => {
    response.setHeader('X-Custom-Header', 'value');
    response.removeHeader('X-Custom-Header');
    expect(response.getHeader('X-Custom-Header')).toBeUndefined();

    // Verify that removeHeader was called on ServerResponse
    expect(mockRemoveHeader).toHaveBeenCalledWith('X-Custom-Header');
  });

  test('should append headers', () => {
    response.append('X-Custom-Header', 'value1');
    response.append('X-Custom-Header', 'value2');
    expect(response.getHeader('X-Custom-Header')).toEqual(['value1', 'value2']);

    // Verify that setHeader was called correctly
    expect(mockSetHeader).toHaveBeenCalledWith('X-Custom-Header', 'value1');
    expect(mockSetHeader).toHaveBeenCalledWith('X-Custom-Header', [
      'value1',
      'value2',
    ]);
  });

  test('should set cookies', () => {
    response.cookie('test', 'value');
    expect(response.cookies.get('test')).toBe('value');

    // Verify that append was called with 'Set-Cookie'
    expect(mockSetHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('test=value'),
    );
  });

  test('should clear cookies', () => {
    response.cookie('test', 'value');
    response.clearCookie('test');

    expect(response.cookies.get('test')).toBe('');

    // Verify that setHeader was called twice:
    // 1. Setting the cookie
    // 2. Clearing the cookie
    expect(mockSetHeader).toHaveBeenCalledTimes(2);

    // Verify the first call sets the cookie
    expect(mockSetHeader).toHaveBeenNthCalledWith(
      1,
      'Set-Cookie',
      expect.stringContaining('test=value'),
    );

    // Verify the second call clears the cookie
    expect(mockSetHeader).toHaveBeenNthCalledWith(
      2,
      'Set-Cookie',
      expect.arrayContaining([
        expect.stringContaining('test=value'),
        expect.stringContaining('test=; Max-Age=0'),
      ]),
    );
  });

  test('should redirect with default status', () => {
    const url = 'http://example.com';
    response.redirect(url);

    expect(response.getStatus()).toBe(StatusCode.FOUND);
    expect(response.getHeader('Location')).toBe(url);

    // Verify that setHeader was called correctly
    expect(mockSetHeader).toHaveBeenCalledWith('Location', url);

    // Verify that statusCode was set
    expect(mockRes.statusCode).toBe(StatusCode.FOUND);

    // Verify that end was called
    expect(mockEnd).toHaveBeenCalled();
  });

  test('should redirect with custom status', () => {
    const url = 'http://example.com';
    response.redirect(StatusCode.MOVED_PERMANENTLY, url);

    expect(response.getStatus()).toBe(StatusCode.MOVED_PERMANENTLY);
    expect(response.getHeader('Location')).toBe(url);

    // Verify that setHeader was called correctly
    expect(mockSetHeader).toHaveBeenCalledWith('Location', url);

    // Verify that statusCode was set
    expect(mockRes.statusCode).toBe(StatusCode.MOVED_PERMANENTLY);

    // Verify that end was called
    expect(mockEnd).toHaveBeenCalled();
  });

  test('should finalize response with end', () => {
    response.status(StatusCode.OK).send('OK');

    // Verify that setHeader was called correctly
    expect(mockSetHeader).toHaveBeenCalledWith(
      'Content-Type',
      ContentType.TEXT,
    );

    // Verify that statusCode was set
    expect(mockRes.statusCode).toBe(StatusCode.OK);

    // Verify that end was called with 'OK'
    expect(mockEnd).toHaveBeenCalledWith('OK');
  });

  test('should not allow modifying headers after response is sent', () => {
    response.send('Hello');

    expect(() => {
      response.setHeader('Another-Header', 'value');
    }).toThrow('Cannot set headers after they are sent to the client.');

    expect(() => {
      response.removeHeader('Content-Type');
    }).toThrow('Cannot remove headers after they are sent to the client.');

    expect(() => {
      response.append('X-Test', 'value');
    }).toThrow('Cannot append headers after they are sent to the client.');
  });

  test('should not allow sending response multiple times', () => {
    response.send('First');

    expect(() => {
      response.send('Second');
    }).toThrow('Cannot send response, headers already sent.');
  });

  test('should handle different body types', () => {
    // Sending a string
    response.send('A simple string');
    expect(mockEnd).toHaveBeenCalledWith('A simple string');

    // Reset mocks
    mockEnd.mockClear();
    response = new Response(mockRes as ServerResponse);

    // Sending a Buffer
    const buffer = Buffer.from('Buffer data');
    response.send(buffer);
    expect(mockEnd).toHaveBeenCalledWith(buffer);

    // Reset mocks
    mockEnd.mockClear();
    response = new Response(mockRes as ServerResponse);

    // Sending an object
    const obj = { key: 'value' };
    response.send(obj);
    expect(response.body).toBe(JSON.stringify(obj));
    expect(mockEnd).toHaveBeenCalledWith(JSON.stringify(obj));
  });
});
