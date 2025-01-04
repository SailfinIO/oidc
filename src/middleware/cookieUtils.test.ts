// src/middleware/cookieUtils.test.ts

import { Headers } from 'node-fetch'; // Ensure you're using the correct Headers implementation
import { parseCookies } from './cookieUtils';
import { parse } from '../utils/Cookie';

jest.mock('../utils/Cookie');

describe('parseCookies', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty object if no Cookie header is present', () => {
    const headers = new Headers();
    expect(parseCookies(headers)).toEqual({});
  });

  it('should parse cookies correctly when Cookie header is present', () => {
    const headers = new globalThis.Headers({
      cookie: 'sessionId=abc123; userId=xyz789',
    });
    const parsed = { sessionId: 'abc123', userId: 'xyz789' };
    (parse as jest.Mock).mockReturnValue(parsed);

    expect(parseCookies(headers)).toEqual(parsed);
    expect(parse).toHaveBeenCalledWith('sessionId=abc123; userId=xyz789');
  });

  it('should parse cookies correctly regardless of header casing', () => {
    const headers = new Headers({ COOKIE: 'sessionId=abc123; userId=xyz789' });
    const parsed = { sessionId: 'abc123', userId: 'xyz789' };
    (parse as jest.Mock).mockReturnValue(parsed);

    expect(parseCookies(headers)).toEqual(parsed);
    expect(parse).toHaveBeenCalledWith('sessionId=abc123; userId=xyz789');
  });

  it('should return empty object and log error if parsing fails', () => {
    const headers = new Headers({ Cookie: 'invalid-cookie' });
    const error = new Error('Parse error');
    (parse as jest.Mock).mockImplementation(() => {
      throw error;
    });
    console.error = jest.fn();

    expect(parseCookies(headers)).toEqual({});
    expect(parse).toHaveBeenCalledWith('invalid-cookie');
    expect(console.error).toHaveBeenCalledWith(
      'Failed to parse cookies:',
      error,
    );
  });
});
