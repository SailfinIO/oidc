import { HttpExceptionBodyMessage } from '../types';

export interface HttpExceptionBody {
  message: HttpExceptionBodyMessage;
  error?: string;
  statusCode: number;
}
