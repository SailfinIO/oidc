import {
  DescriptionAndOptions,
  HttpExceptionBody,
  HttpExceptionOptions,
} from '../interfaces';
import { HttpExceptionBodyMessage } from '../types';
import { ClientError } from './ClientError';

/**
 * Any HTTP exception
 *
 * @publicApi
 */
export declare class HttpException extends ClientError {
  private readonly response;
  private readonly status;
  private readonly options?;
  /**
   * Instantiate a plain HTTP Exception.
   *
   * @example
   * throw new HttpException('message', StatusCode.BAD_REQUEST)
   * throw new HttpException('custom message', StatusCode.BAD_REQUEST, {
   *  cause: new Error('Cause Error'),
   * })
   *
   * @param response string, object describing the error condition or the error cause.
   * @param status HTTP response status code.
   * @param options An object used to add an error cause.
   */
  constructor(
    response: string | Record<string, any>,
    status: number,
    options?: HttpExceptionOptions,
  );
  cause: unknown;
  /**
   * Configures error chaining support
   *
   * @see https://nodejs.org/en/blog/release/v16.9.0/#error-cause
   * @see https://github.com/microsoft/TypeScript/issues/45167
   */
  initCause(): void;
  initMessage(): void;
  initName(): void;
  getResponse(): string | object;
  getStatus(): number;
  static createBody(
    nil: null | '',
    message: HttpExceptionBodyMessage,
    statusCode: number,
  ): HttpExceptionBody;
  static createBody(
    message: HttpExceptionBodyMessage,
    error: string,
    statusCode: number,
  ): HttpExceptionBody;
  static createBody<Body extends Record<string, unknown>>(custom: Body): Body;
  static getDescriptionFrom(
    descriptionOrOptions: string | HttpExceptionOptions,
  ): string;
  static getHttpExceptionOptionsFrom(
    descriptionOrOptions: string | HttpExceptionOptions,
  ): HttpExceptionOptions;
  /**
   * Utility method used to extract the error description and httpExceptionOptions from the given argument.
   * This is used by inheriting classes to correctly parse both options.
   * @returns the error description and the httpExceptionOptions as an object.
   */
  static extractDescriptionAndOptionsFrom(
    descriptionOrOptions: string | HttpExceptionOptions,
  ): DescriptionAndOptions;
}
