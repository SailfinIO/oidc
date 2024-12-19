// src/types/Address.ts

import { UnknownObject } from '../interfaces';
import { Override } from './Override';

export type ExtendedAddress = UnknownObject;

export type Address<ExtendedAddress extends {} = UnknownObject> = Override<
  {
    formatted?: string;
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  },
  ExtendedAddress
>;
