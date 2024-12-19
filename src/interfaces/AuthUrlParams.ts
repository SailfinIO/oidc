// src/interfaces/AuthUrlParams.ts

export interface AuthUrlParams {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}
