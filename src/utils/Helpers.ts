export class Helpers {
  /**
   * Builds a URL-encoded string from the given parameters.
   * @param params - An object containing key-value pairs to encode.
   * @returns A URL-encoded string.
   */
  public static buildUrlEncodedBody(params: Record<string, string>): string {
    return Object.entries(params)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join('&');
  }

  /**
   * Generates a UUID v4 string.
   * @returns A UUID v4 string.
   */
  public static generateUUID(): string {
    // Check if the environment supports crypto for better randomness
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);

      // Set the version to 4 (0100)
      buf[6] = (buf[6] & 0x0f) | 0x40;
      // Set the variant to 10xx
      buf[8] = (buf[8] & 0x3f) | 0x80;

      const byteToHex: string[] = [];
      for (let i = 0; i < 256; ++i) {
        byteToHex.push((i + 0x100).toString(16).substr(1));
      }

      const uuid = (
        byteToHex[buf[0]] +
        byteToHex[buf[1]] +
        byteToHex[buf[2]] +
        byteToHex[buf[3]] +
        '-' +
        byteToHex[buf[4]] +
        byteToHex[buf[5]] +
        '-' +
        byteToHex[buf[6]] +
        byteToHex[buf[7]] +
        '-' +
        byteToHex[buf[8]] +
        byteToHex[buf[9]] +
        '-' +
        byteToHex[buf[10]] +
        byteToHex[buf[11]] +
        byteToHex[buf[12]] +
        byteToHex[buf[13]] +
        byteToHex[buf[14]] +
        byteToHex[buf[15]]
      ).toLowerCase();

      return uuid;
    } else {
      // Fallback to Math.random based generator
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        },
      );
    }
  }
}
