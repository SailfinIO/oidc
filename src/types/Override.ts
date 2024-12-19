// src/types/Ovveride.ts

import { KnownKeys } from './KnownKeys';

export type Override<T1, T2> = Omit<T1, keyof Omit<T2, keyof KnownKeys<T2>>> &
  T2;
