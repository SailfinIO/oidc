import { Provider } from '../types/Provider';

export interface DynamicModule {
  module: any; // The module class being defined
  providers?: Provider;
  exports?: any[];
  imports?: any[]; // Add imports for compatibility with NestJS
  controllers?: any[]; // Add controllers for compatibility if needed
  global?: boolean; // Add global option
}
