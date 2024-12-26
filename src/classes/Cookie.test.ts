// tests/Cookie.test.ts

import { SameSite } from '../enums';
import { Cookie } from './Cookie';

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
