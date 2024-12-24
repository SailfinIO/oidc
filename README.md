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

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Basic Setup](#basic-setup)
  - [Token Management](#token-management)
  - [Device Authorization Flow](#device-authorization-flow)
  - [Token Introspection and Revocation](#token-introspection-and-revocation)
  - [Logging](#logging)
- [Configuration Options](#configuration-options)
- [API Reference](#api-reference)
  - [Methods](#methods)
- [Error Handling](#error-handling)
- [Testing](#testing)
  - [Unit Tests](#unit-tests)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

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
import { Client, Scopes } from '@sailfin/oidc';

const oidcClient = new Client({
  clientId: 'your-client-id',
  redirectUri: 'https://your-app/callback',
  discoveryUrl: 'https://issuer.com/.well-known/openid-configuration',
  scopes: [Scopes.OpenId, Scopes.Profile, Scopes.Email],
});

(async () => {
  // Generate the authorization URL
  const { url, state } = await oidcClient.getAuthorizationUrl();
  console.log(`Visit this URL to authenticate: ${url}`);

  // Handle the redirect with the authorization code
  await oidcClient.handleRedirect('auth-code', state);

  // Fetch user info
  const userInfo = await oidcClient.getUserInfo();
  console.log('User Info:', userInfo);
})();
```

### Token Management

Retrieve, introspect, or revoke tokens with ease:

```typescript
// Get the access token
const accessToken = await oidcClient.getAccessToken();
console.log('Access Token:', accessToken);

// Introspect a token
const tokenInfo = await oidcClient.introspectToken(accessToken);
console.log('Token Introspection:', tokenInfo);

// Revoke a refresh token
await oidcClient.revokeToken('refresh-token', 'refresh_token');
console.log('Refresh token revoked.');
```

### Device Authorization Flow

Supports device code authentication:

```typescript
const { device_code, user_code, verification_uri } =
  await oidcClient.startDeviceAuthorization();

console.log(`Visit ${verification_uri} and enter the code: ${user_code}`);

// Poll for tokens
await oidcClient.pollDeviceToken(device_code);
console.log('Device successfully authorized.');
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

| Parameter      | Type        | Required | Description                                        |
| -------------- | ----------- | -------- | -------------------------------------------------- |
| `clientId`     | `string`    | Yes      | Client ID registered with the OIDC provider.       |
| `clientSecret` | `string`    | No       | Client secret (not needed for public clients).     |
| `discoveryUrl` | `string`    | Yes      | URL to the OIDC provider's discovery endpoint.     |
| `redirectUri`  | `string`    | Yes      | Redirect URI registered with the OIDC provider.    |
| `scopes`       | `Scopes[]`  | Yes      | List of scopes for the OIDC flow (e.g., `openid`). |
| `grantType`    | `GrantType` | No       | Grant type (default: `authorization_code`).        |
| `logLevel`     | `LogLevel`  | No       | Logging level (`info`, `debug`, `warn`, `error`).  |

`Scopes`, `GrantType`, and `LogLevel` are enums provided by the library. This is a non-exhaustive list of available values:

```typescript
enum Scopes {
  OpenId = 'openid',
  Profile = 'profile',
  Email = 'email',
}

enum GrantType {
  AuthorizationCode = 'authorization_code',
  ClientCredentials = 'client_credentials',
  DeviceCode = 'urn:ietf:params:oauth:grant-type:device_code',
}

enum LogLevel {
  Info = 'info',
  Debug = 'debug',
  Warn = 'warn',
  Error = 'error',
}
```

## API Reference

### Methods

- `getAuthorizationUrl()` - Generates an authorization URL for user login.
- `handleRedirect(code, state)` - Processes the authorization code callback.
- `handleRedirectForImplicitFlow(fragment)` - Processes the implicit flow callback.
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

## Testing

### Unit Tests

To run the unit tests, use the following command:

```bash
npm run test
```

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines.

## Support

For issues and feature requests, please [open an issue](https://github.com/sailfinIO/oidc/issues).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
