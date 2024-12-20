/**
 * Interface for Logout URL parameters.
 */
export interface ILogoutUrlParams {
  endSessionEndpoint: string;
  clientId: string;
  postLogoutRedirectUri: string;
  idTokenHint?: string;
  state?: string;
}
