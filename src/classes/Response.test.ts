import { Response } from './Response';
import { ContentType, StatusCode } from '../enums';
import { IResponse } from '../interfaces';

describe('Response', () => {
  let response: IResponse;

  beforeEach(() => {
    response = new Response();
  });

  test('should initialize with default values', () => {
    expect(response.body).toBeNull();
    expect(response.headers.size).toBe(0);
    expect(response.cookies.size).toBe(0);
    expect(response.getStatus()).toBe(StatusCode.OK);
  });

  test('should set status code', () => {
    response.status(StatusCode.CREATED);
    expect(response.getStatus()).toBe(StatusCode.CREATED);
  });

  test('should send JSON body', () => {
    const data = { message: 'Hello, world!' };
    response.json(data);
    expect(response.body).toBe(JSON.stringify(data));
    expect(response.getHeader('Content-Type')).toBe(ContentType.JSON);
  });

  test('should set and get headers', () => {
    response.setHeader('X-Custom-Header', 'value');
    expect(response.getHeader('X-Custom-Header')).toBe('value');
  });

  test('should remove headers', () => {
    response.setHeader('X-Custom-Header', 'value');
    response.removeHeader('X-Custom-Header');
    expect(response.getHeader('X-Custom-Header')).toBeUndefined();
  });

  test('should append headers', () => {
    response.append('X-Custom-Header', 'value1');
    response.append('X-Custom-Header', 'value2');
    expect(response.getHeader('X-Custom-Header')).toEqual(['value1', 'value2']);
  });

  test('should set cookies', () => {
    response.cookie('test', 'value');
    expect(response.cookies.get('test')).toBe('value');
  });

  test('should clear cookies', () => {
    response.cookie('test', 'value');
    response.clearCookie('test');
    expect(response.cookies.get('test')).toBe('');
  });

  test('should redirect with default status', () => {
    const url = 'http://example.com';
    response.redirect(url);
    expect(response.getStatus()).toBe(StatusCode.FOUND);
    expect(response.getHeader('Location')).toBe(url);
  });

  test('should redirect with custom status', () => {
    const url = 'http://example.com';
    response.redirect(StatusCode.MOVED_PERMANENTLY, url);
    expect(response.getStatus()).toBe(StatusCode.MOVED_PERMANENTLY);
    expect(response.getHeader('Location')).toBe(url);
  });

  test('should finalize response', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    response.status(StatusCode.OK).send('OK');
    await response['finalizeResponse']();
    expect(consoleSpy).toHaveBeenCalledWith('Finalizing response...');
    consoleSpy.mockRestore();
  });
});
