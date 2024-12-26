// src/interfaces/ISessionData.ts

import { ITokenResponse } from './ITokenResponse';
import { IUser } from './IUser';

export interface ISessionData {
  cookie: ITokenResponse;
  passport?: IUser;
}
