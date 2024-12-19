// src/interfaces/ISessionData.ts

export interface ISessionData {
  userId: string;
  username?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}
