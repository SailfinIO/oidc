// tests/unit/Logger.spec.ts

import { Logger } from './Logger';
import { LogLevel } from '../enums';

describe('Logger', () => {
  let logger: Logger;

  // Mock console methods
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  const consoleWarnSpy = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => {});
  const consoleInfoSpy = jest
    .spyOn(console, 'info')
    .mockImplementation(() => {});
  const consoleDebugSpy = jest
    .spyOn(console, 'debug')
    .mockImplementation(() => {});
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  // Mock Date to return a fixed date that corresponds to "01/01/2022, 12:00:00 AM" in local time
  // Adjust the time based on your local timezone. For UTC-5, set to "2022-01-01T05:00:00Z"
  const fixedDate = new Date('2022-01-01T05:00:00Z'); // Adjust as needed
  const OriginalDate = Date;
  global.Date = class extends OriginalDate {
    constructor() {
      super();
      return fixedDate;
    }
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Instantiate Logger with default log level (INFO) and without colors for easier testing
    logger = new Logger('TestContext', LogLevel.INFO, false);
  });

  afterAll(() => {
    // Restore original implementations
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleLogSpy.mockRestore();
    global.Date = OriginalDate;
  });

  // Helper function to generate expected timestamp
  const getFormattedTimestamp = () => {
    const now = fixedDate;
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12 || 12;

    return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
  };

  it('should log error messages when log level is INFO', () => {
    logger.error('This is an error message');

    const expectedTimestamp = getFormattedTimestamp();

    expect(console.error).toHaveBeenCalledTimes(1);
    const logMessage = consoleErrorSpy.mock.calls[0][0];
    expect(logMessage).toContain('[ERROR]');
    expect(logMessage).toContain('This is an error message');
    expect(logMessage).toContain('TestContext');
    expect(logMessage).toContain(expectedTimestamp);
  });

  it('should log warn messages when log level is INFO', () => {
    logger.warn('This is a warning message');

    const expectedTimestamp = getFormattedTimestamp();

    expect(console.warn).toHaveBeenCalledTimes(1);
    const logMessage = consoleWarnSpy.mock.calls[0][0];
    expect(logMessage).toContain('[WARN]');
    expect(logMessage).toContain('This is a warning message');
    expect(logMessage).toContain('TestContext');
    expect(logMessage).toContain(expectedTimestamp);
  });

  it('should log info messages when log level is INFO', () => {
    logger.info('This is an info message');

    const expectedTimestamp = getFormattedTimestamp();

    expect(console.info).toHaveBeenCalledTimes(1);
    const logMessage = consoleInfoSpy.mock.calls[0][0];
    expect(logMessage).toContain('[INFO]');
    expect(logMessage).toContain('This is an info message');
    expect(logMessage).toContain('TestContext');
    expect(logMessage).toContain(expectedTimestamp);
  });

  it('should not log debug messages when log level is INFO', () => {
    logger.debug('This is a debug message');

    expect(console.debug).not.toHaveBeenCalled();
  });

  it('should log debug messages when log level is DEBUG', () => {
    logger.setLogLevel(LogLevel.DEBUG);
    logger.debug('This is a debug message');

    const expectedTimestamp = getFormattedTimestamp();

    expect(console.debug).toHaveBeenCalledTimes(1);
    const logMessage = consoleDebugSpy.mock.calls[0][0];
    expect(logMessage).toContain('[DEBUG]');
    expect(logMessage).toContain('This is a debug message');
    expect(logMessage).toContain('TestContext');
    expect(logMessage).toContain(expectedTimestamp);
  });

  it('should not log info messages when log level is ERROR', () => {
    logger.setLogLevel(LogLevel.ERROR);
    logger.info('This is an info message');

    expect(console.info).not.toHaveBeenCalled();
  });

  it('should log error messages even when log level is ERROR', () => {
    logger.setLogLevel(LogLevel.ERROR);
    logger.error('This is an error message');

    const expectedTimestamp = getFormattedTimestamp();

    expect(console.error).toHaveBeenCalledTimes(1);
    const logMessage = consoleErrorSpy.mock.calls[0][0];
    expect(logMessage).toContain('[ERROR]');
    expect(logMessage).toContain('This is an error message');
    expect(logMessage).toContain('TestContext');
    expect(logMessage).toContain(expectedTimestamp);
  });

  it('should include additional data in error logs', () => {
    const error = new Error('Test error');
    logger.error('An error occurred', error);

    const expectedTimestamp = getFormattedTimestamp();

    expect(console.error).toHaveBeenCalledTimes(1);
    const logMessage = consoleErrorSpy.mock.calls[0][0];
    expect(logMessage).toContain('[ERROR]');
    expect(logMessage).toContain('An error occurred');
    expect(logMessage).toContain('TestContext');
    expect(logMessage).toContain(expectedTimestamp);
    expect(logMessage).toContain('Test error');
    expect(logMessage).toContain(error.stack || '');
  });

  it('should handle additional context in warn logs', () => {
    const context = { user: 'John Doe', action: 'login' };
    logger.warn('User action', context);

    const expectedTimestamp = getFormattedTimestamp();

    expect(console.warn).toHaveBeenCalledTimes(1);
    const logMessage = consoleWarnSpy.mock.calls[0][0];
    expect(logMessage).toContain('[WARN]');
    expect(logMessage).toContain('User action');
    expect(logMessage).toContain('TestContext');
    expect(logMessage).toContain(expectedTimestamp);
    expect(logMessage).toContain(JSON.stringify(context));
  });

  it('should handle circular references in additional data gracefully', () => {
    const obj: any = { a: 1 };
    obj.b = obj; // Create a circular reference

    logger.info('Circular reference test', obj);

    const expectedTimestamp = getFormattedTimestamp();

    expect(console.info).toHaveBeenCalledTimes(1);
    const logMessage = consoleInfoSpy.mock.calls[0][0];
    expect(logMessage).toContain('[INFO]');
    expect(logMessage).toContain('Circular reference test');
    expect(logMessage).toContain('TestContext');
    expect(logMessage).toContain(expectedTimestamp);
    expect(logMessage).toContain('[Circular]');
  });

  it('should update the log level correctly', () => {
    logger.setLogLevel(LogLevel.WARN);
    logger.info('This should not be logged');
    logger.warn('This should be logged');

    const expectedTimestamp = getFormattedTimestamp();

    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    const logMessage = consoleWarnSpy.mock.calls[0][0];
    expect(logMessage).toContain('[WARN]');
    expect(logMessage).toContain('This should be logged');
    expect(logMessage).toContain('TestContext');
    expect(logMessage).toContain(expectedTimestamp);
  });
});
