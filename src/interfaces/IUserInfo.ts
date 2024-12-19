// src/interfaces/IUserInfo.ts

import { Address, ExtendedAddress } from '../types';

export interface IUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  updated_at?: number;
  address?: Address<ExtendedAddress>;
}
