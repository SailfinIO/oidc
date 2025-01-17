export type Provider = Array<{
  provide: any;
  useFactory?: (...args: any[]) => any | Promise<any>;
  useExisting?: any;
  useValue?: any;
  useClass?: any;
  inject?: any[];
  scope?: 'DEFAULT' | 'REQUEST';
}>;
