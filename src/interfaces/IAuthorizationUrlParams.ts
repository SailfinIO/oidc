// src/interfaces/IAuthorizationUrlParams.ts

export interface IAuthorizationUrlParams {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  nonce?: string;
  prompt?: string;
  display?: string;
  responseMode?: 'query' | 'fragment' | 'form_post';
}
