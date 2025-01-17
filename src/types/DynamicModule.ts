import { Provider } from './Provider';

export interface DynamicModule {
  module: any;
  providers?: Provider[];
  exports?: any[];
}
