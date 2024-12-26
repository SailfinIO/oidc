import { Cookie, parse, serialize } from './Cookie';
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

describe('Cookie Class', () => {
  it('should create a Cookie instance with valid parameters', () => {
    const cookie = new Cookie('test', 'value', { httpOnly: true });
    expect(cookie.name).toBe('test');
    expect(cookie.value).toBe('value');
    expect(cookie.options?.httpOnly).toBe(true);
  });

  it('should throw an error for invalid cookie name', () => {
    expect(() => new Cookie('invalid name', 'value')).toThrow(TypeError);
  });

  it('should throw an error for invalid cookie value', () => {
    expect(() => new Cookie('name', 'invalid;value')).toThrow(TypeError);
  });

  it('should serialize correctly', () => {
    const cookie = new Cookie('sessionId', 'abc123', {
      httpOnly: true,
      secure: true,
      sameSite: SameSite.LAX,
    });
    const serialized = cookie.serialize();
    expect(serialized).toBe('sessionId=abc123; HttpOnly; Secure; SameSite=Lax');
  });

  it('should parse a cookie string into a Cookie instance', () => {
    const cookieString = 'sessionId=abc123; HttpOnly; Secure; SameSite=Lax';
    const parsed = Cookie.parse(cookieString);
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.name).toBe('sessionId');
      expect(parsed.value).toBe('abc123');
      expect(parsed.options?.httpOnly).toBe(true);
      expect(parsed.options?.secure).toBe(true);
      expect(parsed.options?.sameSite).toBe(SameSite.LAX);
    }
  });

  it('should convert to JSON correctly', () => {
    const cookie = new Cookie('user', 'john_doe', {
      httpOnly: true,
      secure: true,
    });
    const json = cookie.toJSON();
    expect(json).toEqual({
      name: 'user',
      value: 'john_doe',
      options: { httpOnly: true, secure: true },
    });
  });

  it('should update the cookie value with setValue', () => {
    const cookie = new Cookie('token', 'initial');
    cookie.setValue('updatedValue');
    expect(cookie.value).toBe('updatedValue');
  });

  it('should throw an error when setting an invalid value using setValue', () => {
    const cookie = new Cookie('token', 'validValue');
    expect(() => cookie.setValue('invalid;value')).toThrow(TypeError);
  });

  it('should update the cookie options with setOptions', () => {
    const cookie = new Cookie('session', 'abc123', { httpOnly: true });
    cookie.setOptions({ secure: true, sameSite: SameSite.STRICT });
    expect(cookie.options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: SameSite.STRICT,
    });
  });

  it('should preserve existing options when updating with setOptions', () => {
    const cookie = new Cookie('session', 'abc123', {
      httpOnly: true,
      secure: false,
    });
    cookie.setOptions({ secure: true, path: '/home' });
    expect(cookie.options).toEqual({
      httpOnly: true,
      secure: true,
      path: '/home',
    });
  });
});
