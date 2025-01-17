import { ProviderScope as Scope } from '../enums';

export type Provider = {
  provide: any;
  useFactory: (...args: any[]) => any | Promise<any>;
  useExisting?: any;
  useValue?: any;
  useClass?: any;
  inject?: any[];
  scope?: Scope;
};
