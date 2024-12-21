# @sailfin/oidc

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![npm version](https://img.shields.io/npm/v/@sailfin/oidc.svg)
[![CodeQL Advanced](https://github.com/SailfinIO/oidc/actions/workflows/codeql.yml/badge.svg)](https://github.com/SailfinIO/oidc/actions/workflows/codeql.yml)
[![Build](https://github.com/SailfinIO/oidc/actions/workflows/build.yaml/badge.svg)](https://github.com/SailfinIO/oidc/actions/workflows/build.yaml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_oidc&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=SailfinIO_oidc)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_oidc&metric=coverage)](https://sonarcloud.io/summary/new_code?id=SailfinIO_oidc)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_oidc&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=SailfinIO_oidc)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_oidc&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=SailfinIO_oidc)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=SailfinIO_oidc&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=SailfinIO_oidc)

## Overview

`@sailfin/oidc` is a fully-featured OpenID Connect (OIDC) client library designed for seamless integration with OIDC providers, including Sailfin's OIDC provider. It enables user authentication, token management, and secure interaction with APIs that support the OIDC standard.

This library is built for enterprise-grade TypeScript and Node.js applications, adhering to modern TypeScript practices. It supports multiple grant types, token validation, user information retrieval, and more.

**This package it under active development and is not yet ready for production use. Please use with caution and report any issues or bugs you encounter.**

## Features

- **Authorization URL Generation**: Supports PKCE and state validation.
- **Token Management**: Access, refresh, and ID tokens handling.
- **User Info Retrieval**: Fetch user details securely using the userinfo endpoint.
- **Device Authorization Flow**: Simplified device code handling and polling.
- **Token Introspection and Revocation**: Validate and manage tokens efficiently.
- **Discovery Endpoint Support**: Dynamically fetches and caches OIDC configuration.
- **Flexible Configuration**: Works with any OIDC-compliant provider.

## Installation

Install the package using npm:

```bash
npm install @sailfin/oidc
```

or with Yarn:

```bash
yarn add @sailfin/oidc
```

## Usage

### Basic Setup

Here's an example of initializing and using the `OIDCClient`:

```typescript
import { OIDCClient } from '@sailfin/oidc';

const oidcClient = new OIDCClient({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  discoveryUrl:
    'https://your-oidc-provider.com/.well-known/openid-configuration',
  redirectUri: 'https://your-redirect-uri.com',
  scopes: ['openid', 'profile', 'email'],
  grantType: 'authorization_code',
});

(async () => {
  // Initialize the OIDC client
  await oidcClient.initialize();

  // Generate an authorization URL
  const { url } = await oidcClient.getAuthorizationUrl();
  console.log(`Visit this URL to authenticate: ${url}`);

  // Handle redirect after authentication (use your framework's routing to get the code and state)
  await oidcClient.handleRedirect(
    'your-authorization-code',
    'your-returned-state',
  );

  // Retrieve user information
  const userInfo = await oidcClient.getUserInfo();
  console.log(userInfo);
})();
```

### Token Management

Refresh and retrieve tokens with ease:

```typescript
const accessToken = await oidcClient.getAccessToken();
console.log(`Access Token: ${accessToken}`);

const tokens = oidcClient.getTokens();
console.log('Tokens:', tokens);

// Clear stored tokens
oidcClient.clearTokens();
```

### Device Authorization Flow

Supports device code authentication:

```typescript
const deviceAuthorization = await oidcClient.startDeviceAuthorization();
console.log(
  'Enter the code on this page:',
  deviceAuthorization.verification_uri,
);
console.log('Your user code:', deviceAuthorization.user_code);

// Poll for tokens
await oidcClient.pollDeviceToken(deviceAuthorization.device_code);

console.log('Device successfully authorized!');
```

### Token Introspection and Revocation

```typescript
// Introspect a token
const introspection = await oidcClient.introspectToken('your-token');
console.log('Token introspection:', introspection);

// Revoke a token
await oidcClient.revokeToken('your-refresh-token', 'refresh_token');
console.log('Token revoked.');
```

### Logging

Customize the logging level:

```typescript
oidcClient.setLogLevel('debug');
```

## Configuration Options

Below are the required and optional parameters for initializing the `OIDCClient`:

| Parameter      | Type       | Required | Description                                        |
| -------------- | ---------- | -------- | -------------------------------------------------- |
| `clientId`     | `string`   | Yes      | Client ID registered with the OIDC provider.       |
| `clientSecret` | `string`   | No       | Client secret (not needed for public clients).     |
| `discoveryUrl` | `string`   | Yes      | URL to the OIDC provider's discovery endpoint.     |
| `redirectUri`  | `string`   | Yes      | Redirect URI registered with the OIDC provider.    |
| `scopes`       | `string[]` | Yes      | List of scopes for the OIDC flow (e.g., `openid`). |
| `grantType`    | `string`   | No       | Grant type (default: `authorization_code`).        |
| `logLevel`     | `string`   | No       | Logging level (`info`, `debug`, `warn`, `error`).  |

## API Reference

### Methods

- `initialize()` - Fetches discovery configuration and initializes the client.
- `getAuthorizationUrl()` - Generates an authorization URL for user login.
- `handleRedirect(code, state)` - Handles redirect after login for authorization code flow.
- `getUserInfo()` - Fetches user info from the userinfo endpoint.
- `getAccessToken()` - Retrieves the current access token, refreshing it if necessary.
- `clearTokens()` - Clears all stored tokens.
- `startDeviceAuthorization()` - Initiates device authorization flow.
- `pollDeviceToken(device_code, interval, timeout)` - Polls for tokens in device authorization flow.
- `introspectToken(token)` - Introspects a token.
- `revokeToken(token, tokenTypeHint)` - Revokes a token.
- `setLogLevel(level)` - Sets the log level.

## Error Handling

The library throws `ClientError` for all error scenarios, ensuring consistent error handling. Each error includes a `message`, `code`, and optional `details` field.

Example:

```typescript
try {
  await oidcClient.getUserInfo();
} catch (error) {
  if (error instanceof ClientError) {
    console.error(`Error Code: ${error.code}`);
    console.error(`Error Message: ${error.message}`);
  } else {
    console.error('An unexpected error occurred:', error);
  }
}
```

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines.

## Support

For issues and feature requests, please [open an issue](https://github.com/sailfinIO/oidc/issues).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Happy coding! 🎉
