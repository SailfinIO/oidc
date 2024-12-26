import { parse, serialize } from './cookie';
import { Priority, SameSite } from '../enums';

describe('parse', () => {
  it('should return an empty object for empty header', () => {
    const result = parse('');
    expect(result).toEqual({});
  });

  it('should parse a single cookie', () => {
    const header = 'sessionId=abc123';
    const result = parse(header);
    expect(result).toEqual({ sessionId: 'abc123' });
  });

  it('should parse multiple cookies', () => {
    const header = 'sessionId=abc123; userId=789xyz';
    const result = parse(header);
    expect(result).toEqual({ sessionId: 'abc123', userId: '789xyz' });
  });

  it('should handle whitespace around keys and values', () => {
    const header = ' sessionId = abc123 ; userId = 789xyz ';
    const result = parse(header);
    expect(result).toEqual({ sessionId: 'abc123', userId: '789xyz' });
  });

  it('should decode encoded cookie values', () => {
    const header = 'sessionId=abc%20123';
    const result = parse(header);
    expect(result).toEqual({ sessionId: 'abc 123' });
  });

  it('should use custom decode function if provided', () => {
    const header = 'sessionId=abc%20123';
    const customDecode = jest.fn((val: string) => val.replace('%20', ' '));
    const result = parse(header, { decode: customDecode });
    expect(customDecode).toHaveBeenCalledWith('abc%20123');
    expect(result).toEqual({ sessionId: 'abc 123' });
  });

  it('should ignore invalid cookie segments', () => {
    const header = 'invalidSegment; sessionId=abc123';
    const result = parse(header);
    expect(result).toEqual({ sessionId: 'abc123' });
  });

  it('should skip whitespace-only segments', () => {
    const header = '   ;  sessionId=abc123';
    const result = parse(header);
    expect(result).toEqual({ sessionId: 'abc123' });
  });

  it('should handle trailing whitespace in cookie values', () => {
    const header = 'sessionId=abc123   ;';
    const result = parse(header);
    expect(result).toEqual({ sessionId: 'abc123' });
  });

  it('should return an object with no prototype', () => {
    const header = 'sessionId=abc123';
    const result = parse(header);
    expect(Object.getPrototypeOf(result)).toBeNull();
  });
});

describe('serialize', () => {
  it('should serialize a basic cookie', () => {
    const result = serialize('sessionId', 'abc123');
    expect(result).toBe('sessionId=abc123');
  });

  it('should throw error for invalid domain', () => {
    expect(() =>
      serialize('sessionId', 'abc123', { domain: 'invalid domain' }),
    ).toThrow('Invalid domain: invalid domain');
  });

  it('should throw error for non-integer maxAge', () => {
    // @ts-ignore Testing runtime behavior with invalid input
    expect(() => serialize('sessionId', 'abc123', { maxAge: '3600' })).toThrow(
      'Invalid maxAge: 3600',
    );
  });
  it('should serialize with the Partitioned attribute', () => {
    const result = serialize('sessionId', 'abc123', { partitioned: true });
    expect(result).toBe('sessionId=abc123; Partitioned');
  });

  it('should throw error for invalid path', () => {
    expect(() =>
      serialize('sessionId', 'abc123', { path: 'invalid;path' }),
    ).toThrow('Invalid path: invalid;path');
  });

  it('should throw error for invalid expires', () => {
    expect(() =>
      // @ts-ignore Testing runtime behavior with invalid input
      serialize('sessionId', 'abc123', { expires: 'invalid date' }),
    ).toThrow('Invalid expires: invalid date');
  });

  it('should encode cookie value', () => {
    const result = serialize('sessionId', 'abc 123');
    expect(result).toBe('sessionId=abc%20123');
  });

  it('should ignore unknown attributes in options', () => {
    // @ts-ignore Testing runtime behavior with invalid input
    const result = serialize('sessionId', 'abc123', { unknownAttr: true });
    expect(result).toBe('sessionId=abc123');
  });

  it('should use custom encode function if provided', () => {
    const customEncode = jest.fn((val: string) => val.replace(' ', '_'));
    const result = serialize('sessionId', 'abc 123', { encode: customEncode });
    expect(customEncode).toHaveBeenCalledWith('abc 123');
    expect(result).toBe('sessionId=abc_123');
  });

  it('should throw error for invalid cookie name', () => {
    expect(() => serialize('invalid name', 'value')).toThrow(
      'Invalid cookie name: invalid name',
    );
  });

  it('should serialize with maxAge attribute', () => {
    const result = serialize('sessionId', 'abc123', { maxAge: 3600 });
    expect(result).toBe('sessionId=abc123; Max-Age=3600');
  });

  it('should serialize with domain attribute', () => {
    const result = serialize('sessionId', 'abc123', { domain: 'example.com' });
    expect(result).toBe('sessionId=abc123; Domain=example.com');
  });

  it('should serialize with path attribute', () => {
    const result = serialize('sessionId', 'abc123', { path: '/home' });
    expect(result).toBe('sessionId=abc123; Path=/home');
  });

  it('should serialize with expires attribute', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    const result = serialize('sessionId', 'abc123', { expires: date });
    expect(result).toBe(
      'sessionId=abc123; Expires=Sun, 01 Jan 2023 00:00:00 GMT',
    );
  });

  it('should serialize with httpOnly and secure attributes', () => {
    const result = serialize('sessionId', 'abc123', {
      httpOnly: true,
      secure: true,
    });
    expect(result).toBe('sessionId=abc123; HttpOnly; Secure');
  });

  it('should serialize with priority and sameSite attributes', () => {
    const result = serialize('sessionId', 'abc123', {
      priority: Priority.HIGH,
      sameSite: SameSite.STRICT,
    });
    expect(result).toBe('sessionId=abc123; Priority=High; SameSite=Strict');
  });

  it('should throw error for invalid priority', () => {
    expect(() =>
      // @ts-ignore
      serialize('sessionId', 'abc123', { priority: 'invalid' }),
    ).toThrow('Invalid priority: invalid');
  });

  it('should throw error for invalid sameSite', () => {
    expect(() =>
      // @ts-ignore
      serialize('sessionId', 'abc123', { sameSite: 'invalid' }),
    ).toThrow('Invalid sameSite: invalid');
  });

  it('should handle multiple attributes', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    const result = serialize('sessionId', 'abc123', {
      maxAge: 3600,
      domain: 'example.com',
      path: '/home',
      expires: date,
      httpOnly: true,
      secure: true,
      priority: Priority.MEDIUM,
      sameSite: SameSite.LAX,
    });
    expect(result).toBe(
      'sessionId=abc123; Max-Age=3600; Domain=example.com; Path=/home; Expires=Sun, 01 Jan 2023 00:00:00 GMT; HttpOnly; Secure; Priority=Medium; SameSite=Lax',
    );
  });
});
