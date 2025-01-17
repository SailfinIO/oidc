export type Provider = {
  provide: any;
  useFactory?: (...args: any[]) => any | Promise<any>;
  useExisting?: any;
  useValue?: any;
  useClass?: any;
};
