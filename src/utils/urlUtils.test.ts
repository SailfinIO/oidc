// src/utils/urlUtils.test.ts

import {
  buildUrlEncodedBody,
  buildAuthorizationUrl,
  base64UrlEncode,
  base64UrlDecode,
} from './urlUtils';
import { AuthUrlParams } from '../interfaces/AuthUrlParams';
import { Algorithm } from '../enums';
import { ClientError } from '../errors/ClientError';

describe('urlUtils', () => {
  describe('buildUrlEncodedBody', () => {
    it('should build a URL-encoded string from given parameters', () => {
      const params = {
        grant_type: 'authorization_code',
        code: 'abc123',
        redirect_uri: 'https://example.com/callback',
      };

      const encoded = buildUrlEncodedBody(params);
      expect(encoded).toBe(
        'grant_type=authorization_code&code=abc123&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback',
      );
    });

    it('should handle empty parameter objects gracefully', () => {
      const params = {};
      const encoded = buildUrlEncodedBody(params);
      expect(encoded).toBe('');
    });

    it('should correctly URL-encode special characters', () => {
      const params = {
        param: 'foo bar',
        another: 'foo+bar/baz?',
      };
      const encoded = buildUrlEncodedBody(params);
      expect(encoded).toBe('param=foo%20bar&another=foo%2Bbar%2Fbaz%3F');
    });
  });

  describe('buildAuthorizationUrl', () => {
    const baseParams: AuthUrlParams = {
      authorizationEndpoint: 'https://auth.example.com/oauth2/authorize',
      clientId: 'myclientid',
      redirectUri: 'https://example.com/callback',
      responseType: 'code',
      scope: 'openid profile',
      state: 'xyz',
    };

    it('should build a valid authorization URL with minimal parameters', () => {
      const url = buildAuthorizationUrl(baseParams);
      const expectedUrl = `https://auth.example.com/oauth2/authorize?response_type=code&client_id=myclientid&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&scope=openid+profile&state=xyz`;
      expect(url).toBe(expectedUrl);
    });

    it('should include code_challenge and code_challenge_method if provided', () => {
      const paramsWithChallenge = {
        ...baseParams,
        codeChallenge: 'challenge123',
        codeChallengeMethod: Algorithm.SHA256,
      };

      const url = buildAuthorizationUrl(paramsWithChallenge);
      const expectedUrl = `https://auth.example.com/oauth2/authorize?response_type=code&client_id=myclientid&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&scope=openid+profile&state=xyz&code_challenge=challenge123&code_challenge_method=SHA256`;
      expect(url).toBe(expectedUrl);
    });

    it('should default code_challenge_method to SHA256 if only code_challenge is provided', () => {
      const paramsWithOnlyChallenge = {
        ...baseParams,
        codeChallenge: 'challengeOnly',
      };
      const url = buildAuthorizationUrl(paramsWithOnlyChallenge);
      const expectedUrl = `https://auth.example.com/oauth2/authorize?response_type=code&client_id=myclientid&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&scope=openid+profile&state=xyz&code_challenge=challengeOnly&code_challenge_method=SHA256`;
      expect(url).toBe(expectedUrl);
    });

    it('should include additional parameters if provided', () => {
      const additionalParams = {
        prompt: 'consent',
        acr_values: 'urn:mace:incommon:iap:silver',
      };
      const url = buildAuthorizationUrl(baseParams, additionalParams);
      const expectedUrl = `https://auth.example.com/oauth2/authorize?response_type=code&client_id=myclientid&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&scope=openid+profile&state=xyz&prompt=consent&acr_values=urn%3Amace%3Aincommon%3Aiap%3Asilver`;
      expect(url).toBe(expectedUrl);
    });

    it('should throw a ClientError if building the URL fails', () => {
      const invalidParams = {
        ...baseParams,
        authorizationEndpoint: 'not a valid url',
      };
      expect(() => buildAuthorizationUrl(invalidParams)).toThrow(ClientError);
    });
  });

  describe('base64 utilities', () => {
    it('should encode a buffer to a base64url string', () => {
      const input = Buffer.from('Hello World');
      const encoded = base64UrlEncode(input);
      // The standard Base64 for "Hello World" is "SGVsbG8gV29ybGQ="
      // After base64url encoding (removing '=' and making it URL safe), we get "SGVsbG8gV29ybGQ"
      expect(encoded).toBe('SGVsbG8gV29ybGQ');
    });

    it('should decode a base64url string to a buffer', () => {
      const input = 'SGVsbG8gV29ybGQ';
      const decoded = base64UrlDecode(input);
      expect(decoded.toString('utf8')).toBe('Hello World');
    });

    it('should encode and decode back to the original buffer', () => {
      const originalStr = 'Testing base64url!';
      const originalBuffer = Buffer.from(originalStr, 'utf8');

      const encoded = base64UrlEncode(originalBuffer);
      const decoded = base64UrlDecode(encoded);

      expect(decoded.equals(originalBuffer)).toBe(true);
      expect(decoded.toString('utf8')).toBe(originalStr);
    });

    it('should handle padding correctly', () => {
      // Some Base64 strings require multiple '=' characters to pad out their length.
      // Let's test a scenario that would require padding.
      const originalStr = 'foo';
      const originalBuffer = Buffer.from(originalStr, 'utf8');

      const encoded = base64UrlEncode(originalBuffer);
      // "foo" in base64 is "Zm9v"
      // Base64url encoded: "Zm9v" (no padding needed in this case)
      expect(encoded).toBe('Zm9v');

      const decoded = base64UrlDecode(encoded);
      expect(decoded.toString('utf8')).toBe(originalStr);
    });

    it('should correctly handle characters that would normally be replaced in base64url', () => {
      // Test a value that includes '+' and '/' in its standard Base64 form.
      // For example, the byte 0xFB (in hex) is '+/8=' in standard Base64. Let's try something that produces these chars.
      const inputBuffer = Buffer.from([0xfb, 0xff, 0x00]); // arbitrary bytes
      const encoded = base64UrlEncode(inputBuffer);
      // This would normally contain '+' and '/' in its Base64 representation.
      // Check that it's been replaced properly.
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');

      const decoded = base64UrlDecode(encoded);
      expect(decoded.equals(inputBuffer)).toBe(true);
    });
  });
});
