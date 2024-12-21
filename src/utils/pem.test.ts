// src/utils/pem.test.ts

import { wrapPem } from './pem';

describe('wrapPem', () => {
  it('should wrap a short Base64 string in PEM format with a given label', () => {
    const input = 'YWJjMTIz'; // base64 for "abc123"
    const label = 'TEST LABEL';
    const expected = `-----BEGIN TEST LABEL-----
YWJjMTIz
-----END TEST LABEL-----`;

    const result = wrapPem(input, label);
    expect(result).toBe(expected);
  });

  it('should split a long Base64 string into multiple 64-character lines', () => {
    // Generate a 130-character base64 string (arbitrary characters)
    const input =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    // Length check: 26 uppercase + 26 lowercase + 10 digits + 2 symbols (+/) + another 26 uppercase = 90 characters total
    // Let's make it exactly 130 by repeating some pattern:
    const extendedInput = input + input.slice(0, 40); // adds 40 more chars = 130 total
    expect(extendedInput.length).toBe(130);

    const label = 'LONG TEST';
    const result = wrapPem(extendedInput, label);

    // Split the result to verify line structure
    const lines = result.split('\n');
    // The first line should be the BEGIN line, and the last line should be the END line
    expect(lines[0]).toBe('-----BEGIN LONG TEST-----');
    expect(lines[lines.length - 1]).toBe('-----END LONG TEST-----');

    // The lines in between should be 64 characters each, except possibly the last one
    const contentLines = lines.slice(1, -1);
    contentLines.forEach((line, idx) => {
      if (idx < contentLines.length - 1) {
        expect(line.length).toBe(64);
      } else {
        // Last line may be shorter
        expect(line.length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(64);
      }
    });
  });

  it('should handle an empty base64 string gracefully', () => {
    const input = '';
    const label = 'EMPTY';
    const expected = `-----BEGIN EMPTY-----

-----END EMPTY-----`;

    const result = wrapPem(input, label);
    expect(result).toBe(expected);
  });

  it('should handle labels with spaces and special characters', () => {
    const input = 'YQ=='; // base64 for "a"
    const label = 'MY LABEL 123!@#';
    const expected = `-----BEGIN MY LABEL 123!@#-----
YQ==
-----END MY LABEL 123!@#-----`;

    const result = wrapPem(input, label);
    expect(result).toBe(expected);
  });
});
