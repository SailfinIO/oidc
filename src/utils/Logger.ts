import { ILogger } from '../interfaces';
import { LogLevel } from '../enums';
import { ColorCodes, ResetCode } from './ColorCodes';

/**
 * A simple, customizable logger class for logging messages at various log levels.
 * Provides options for colored output and context-based logging.
 *
 * @module Logger
 * @example
 * const logger = new Logger('MyClass', LogLevel.INFO, true);
 * logger.info('This is an info message');
 * logger.error('This is an error message');
 * logger.warn('This is a warning message');
 * logger.debug('This is a debug message');
 * logger.verbose('This is a verbose message');
 */
export class Logger implements ILogger {
  private context: string;
  private currentLogLevel: LogLevel;
  private useColors: boolean;

  /**
   * Creates a new instance of the Logger.
   * @param context - Identifies the origin or purpose of log messages.
   * @param logLevel - Sets the initial log level; defaults to LogLevel.INFO.
   * @param useColors - Enables color-coded output if true; defaults to true.
   */
  constructor(
    context: string,
    logLevel: LogLevel = LogLevel.INFO,
    useColors: boolean = true,
  ) {
    this.context = context;
    this.currentLogLevel = logLevel;
    this.useColors = useColors;
  }

  /**
   * Sets the log level for the logger, defining the minimum severity of messages to log.
   * @param level - The log level to apply (e.g., LogLevel.ERROR, LogLevel.DEBUG).
   * @example
   * logger.setLogLevel(LogLevel.DEBUG);
   */
  public setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  /**
   * Determines whether a given log level should be logged based on the current log level setting.
   * @param level - The log level to evaluate.
   * @returns True if the specified level meets or exceeds the current log level; otherwise, false.
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = [
      LogLevel.ERROR,
      LogLevel.WARN,
      LogLevel.INFO,
      LogLevel.DEBUG,
    ];
    return levels.indexOf(level) <= levels.indexOf(this.currentLogLevel);
  }

  /**
   * Converts unknown data types into a log-friendly string format.
   * @param data - The data to process.
   * @returns A stringified version of the data, or a message indicating a failure to stringify.
   */
  private processUnknown(data?: unknown): string {
    if (data === undefined) {
      return '';
    }
    if (typeof data === 'string') {
      return data;
    }
    if (data instanceof Error) {
      return `${data.message}\n${data.stack}`;
    }
    try {
      return JSON.stringify(data, this.circularReplacer());
    } catch {
      return 'Unable to stringify additional data';
    }
  }

  /**
   * Provides a replacer function to handle circular references in objects.
   * @returns A function that replaces circular references with "[Circular]".
   */
  private circularReplacer() {
    const seen = new WeakSet();
    return (_key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  /**
   * Generates a human-readable timestamp for log messages.
   * @returns The current date and time in a readable string format.
   * @example
   * const timestamp = this.formatTimestamp();
   * console.log(timestamp);
   * // Output: "01/01/2022, 12:00:00 AM"
   */
  private formatTimestamp(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12 || 12;

    return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
  }

  /**
   * Constructs and formats a log message with optional colors and additional data.
   * @param level - The log level of the message (e.g., LogLevel.ERROR).
   * @param message - The main message to log.
   * @param additionalData - Optional additional data to include with the message.
   * @returns A formatted string ready for logging.
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    additionalData?: string,
  ): string {
    const timestamp = this.formatTimestamp();
    const pid = process.pid;

    const white = this.useColors ? ColorCodes['white'] : '';
    const yellow = this.useColors ? ColorCodes['yellow'] : '';
    const reset = this.useColors ? ResetCode : '';
    const color = this.useColors ? ColorCodes[level] || '' : '';

    let formattedMessage = `${white}${pid} - ${timestamp}${reset} `;
    formattedMessage += `${color}[${level.toUpperCase()}]${reset} `;
    formattedMessage += `${yellow}[${this.context}]${reset} `;
    formattedMessage += `${color}${message}${reset}`;

    if (additionalData) {
      formattedMessage += ` | ${color}${additionalData}${reset}`;
    }

    return formattedMessage;
  }

  /**
   * Logs an error message to the console, with optional trace information.
   * @param message - The error message.
   * @param trace - Optional trace data to include.
   * @example
   * logger.error('An error occurred', new Error('Error details'));
   */
  public error(message: string, trace?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formattedTrace = this.processUnknown(trace);
      console.error(
        this.formatMessage(LogLevel.ERROR, message, formattedTrace),
      );
    }
  }

  /**
   * Logs a warning message to the console, with optional context.
   * @param message - The warning message.
   * @param context - Optional additional context.
   * @example
   * logger.warn('Potential issue detected');
   */
  public warn(message: string, context?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formattedContext = this.processUnknown(context);
      console.warn(
        this.formatMessage(LogLevel.WARN, message, formattedContext),
      );
    }
  }

  /**
   * Logs an informational message to the console, with optional context.
   * @param message - The informational message.
   * @param context - Optional additional context.
   * @example
   * logger.info('System operational');
   */
  public info(message: string, context?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formattedContext = this.processUnknown(context);
      console.info(
        this.formatMessage(LogLevel.INFO, message, formattedContext),
      );
    }
  }

  /**
   * Logs a debug message to the console, with optional context for troubleshooting.
   * @param message - The debug message.
   * @param context - Optional additional context.
   * @example
   * logger.debug('Debugging application flow');
   */
  public debug(message: string, context?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formattedContext = this.processUnknown(context);
      console.debug(
        this.formatMessage(LogLevel.DEBUG, message, formattedContext),
      );
    }
  }
}
