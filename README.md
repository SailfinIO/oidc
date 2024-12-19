# @sailfin/oidc

## Description

This is a simple OpenID Connect (OIDC) client library for Sailfin. It is designed to be used with Sailfin's OIDC provider. It can be used to authenticate users and obtain tokens for Sailfin's APIs. It can also be used to validate tokens obtained from Sailfin's OIDC provider. The library is designed to be used in a Node.js environment. It can also be used with any other OIDC provider that supports the OIDC standard.

## Installation

```bash
$ npm install @sailfin/oidc
```

## Usage

```typescript
import { OidcClient } from '@sailfin/oidc';

const oidcClient = new OidcClient({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  issuer: 'https://your-oidc-provider.com',
  redirectUri: 'https://your-redirect-uri.com',
  scopes: ['openid', 'profile', 'email'],
  responseType: 'code',
  responseMode: 'query',
  prompt: 'consent',
  nonce: 'your-nonce',
  state: 'your-state',
  codeVerifier: 'your-code-verifier',
  codeChallenge: 'your-code-challenge',
  codeChallengeMethod: 'S256',
  tokenEndpointAuthMethod: 'client_secret_basic',
  grantType: 'authorization_code',
  tokenEndpointAuthSigningAlg: 'RS256',
  idTokenSigningAlg: 'RS256',
  idTokenEncryptionAlg: 'RSA-OAEP',
});

const authorizationUrl = oidcClient.getAuthorizationUrl();
console.log(authorizationUrl);

const token = await oidcClient.getToken('your-authorization-code');
console.log(token);

const userInfo = await oidcClient.getUserInfo(token.accessToken);
console.log(userInfo);

const isValid = oidcClient.validateToken(token.idToken);
console.log(isValid);
```

## Support

Please [open an issue](https://github.con/sailfinIO/oidc/issues) for support.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
