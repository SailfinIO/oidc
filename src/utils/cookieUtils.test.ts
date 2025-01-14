// src/middleware/cookieUtils.test.ts

import { parseCookies, setCookieHeader } from '../utils/cookieUtils';
import { parse } from '../utils/Cookie';
import { IResponse } from '../interfaces';

jest.mock('../utils/Cookie');

describe('parseCookies', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should return empty object if no Cookie header is present (Plain Object)', () => {
    const headers = {};
    expect(parseCookies(headers)).toEqual({});
  });

  it('should parse cookies correctly when Cookie header is present (Plain Object)', () => {
    const headers = { cookie: 'sessionId=abc123; userId=xyz789' };
    const parsed = { sessionId: 'abc123', userId: 'xyz789' };
    (parse as jest.Mock).mockReturnValue(parsed);

    expect(parseCookies(headers)).toEqual(parsed);
    expect(parse).toHaveBeenCalledWith('sessionId=abc123; userId=xyz789');
  });

  it('should parse cookies correctly regardless of header casing (Plain Object)', () => {
    const headers = { COOKIE: 'sessionId=abc123; userId=xyz789' };
    const parsed = { sessionId: 'abc123', userId: 'xyz789' };
    (parse as jest.Mock).mockReturnValue(parsed);

    expect(parseCookies(headers)).toEqual(parsed);
    expect(parse).toHaveBeenCalledWith('sessionId=abc123; userId=xyz789');
  });

  it('should return empty object and log error if parsing fails (Plain Object)', () => {
    const headers = { Cookie: 'invalid-cookie' };
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

  describe('setCookieHeader', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });

    it('should do nothing if response is undefined', () => {
      // Just ensure it doesn't throw
      expect(() => setCookieHeader(undefined, 'myCookie=value')).not.toThrow();
    });

    describe('Express-style response', () => {
      let expressRes: any;

      beforeEach(() => {
        expressRes = {
          getHeader: jest.fn(),
          setHeader: jest.fn(),
        };
      });

      it('should set cookie when none existed before', () => {
        expressRes.getHeader.mockReturnValue(undefined);

        setCookieHeader(expressRes, 'myCookie=one');

        // Expect getHeader was called
        expect(expressRes.getHeader).toHaveBeenCalledWith('Set-Cookie');

        // Expect setHeader was called with an array containing our new cookie
        expect(expressRes.setHeader).toHaveBeenCalledWith('Set-Cookie', [
          'myCookie=one',
        ]);
      });

      it('should append cookie when one string cookie existed', () => {
        expressRes.getHeader.mockReturnValue('existingCookie=abc123');

        setCookieHeader(expressRes, 'myCookie=one');

        // Should receive both existing and new cookie in an array
        expect(expressRes.setHeader).toHaveBeenCalledWith('Set-Cookie', [
          'existingCookie=abc123',
          'myCookie=one',
        ]);
      });

      it('should append cookie when multiple cookies already existed', () => {
        expressRes.getHeader.mockReturnValue([
          'cookieOne=aaa',
          'cookieTwo=bbb',
        ]);

        setCookieHeader(expressRes, 'myCookie=ccc');

        expect(expressRes.setHeader).toHaveBeenCalledWith('Set-Cookie', [
          'cookieOne=aaa',
          'cookieTwo=bbb',
          'myCookie=ccc',
        ]);
      });

      it('should coerce weird existing cookie header into string and append', () => {
        expressRes.getHeader.mockReturnValue(12345);

        setCookieHeader(expressRes, 'myCookie=value');

        expect(expressRes.setHeader).toHaveBeenCalledWith('Set-Cookie', [
          '12345',
          'myCookie=value',
        ]);
      });
    });

    describe('Fetch-like response', () => {
      let fetchLikeRes: IResponse;

      beforeEach(() => {
        // Minimal shape for a fetch-like Response
        fetchLikeRes = {
          headers: {
            append: jest.fn(),
          },
        } as any;
      });

      it('should append a new Set-Cookie header line', () => {
        setCookieHeader(fetchLikeRes, 'fetchCookie=value');

        // Expect that headers.append was called
        expect(fetchLikeRes.headers.append).toHaveBeenCalledWith(
          'Set-Cookie',
          'fetchCookie=value',
        );
      });
    });

    describe('Unrecognized response', () => {
      let unknownRes: any;

      beforeEach(() => {
        unknownRes = {}; // does not match Express or fetch-like
        console.warn = jest.fn();
      });

      it('should log a warning', () => {
        setCookieHeader(unknownRes, 'someCookie=test');
        expect(console.warn).toHaveBeenCalledWith(
          'Unable to set cookie. The response object is not recognized as Express or fetch-like.',
        );
      });
    });
  });
});
