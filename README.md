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

## Table of Contents

- [Design Philosophy](#design-philosophy)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Basic Setup](#basic-setup)
  - [Session Management](#session-management)
    - [Custom Session Store](#custom-session-store)
  - [Token Management](#token-management)
  - [Device Authorization Flow](#device-authorization-flow)
  - [Token Introspection and Revocation](#token-introspection-and-revocation)
  - [Logout](#logout)
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

## Design Philosophy

To ensure a lightweight and dependency-free experience, `@sailfin/oidc` incorporates several internally built utility functions. These utilities handle complex operations such as DER encoding, key conversions, and asynchronous control flows without relying on external packages, providing a seamless and efficient integration for your applications. These utilities are designed to be modular and can be used independently in other projects, although they are primarily intended for internal use within the library and are not exposed as part of the public API. Feel free to explore the `src/utils` directory to learn more about these utilities.

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

Here's an example of initializing and using the `@sailfin/oidc` client:

```typescript
import {
  Client,
  Scopes,
  GrantType,
  StorageMechanism,
  LogLevel,
  SameSite,
} from '@sailfin/oidc';

// Create a new OIDC Client instance
const oidcClient = new Client({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app.com/callback',
  discoveryUrl: 'https://issuer.com/.well-known/openid-configuration',
  scopes: [Scopes.OpenId, Scopes.Profile, Scopes.Email],
  grantType: GrantType.AuthorizationCode,
  // Optional session config
  session: {
    mechanism: StorageMechanism.MEMORY, // or COOKIE, or custom store
    useSilentRenew: false,
    // Only needed if using cookie-based sessions
    cookie: {
      name: 'my_session',
      options: {
        secure: true,
        httpOnly: true,
        sameSite: SameSite.STRICT,
        path: '/',
        maxAge: 3600,
      },
    },
  },
  logging: {
    logLevel: LogLevel.INFO, // or DEBUG, WARN, ERROR
  },
});

(async () => {
  // 1) Generate the Authorization URL
  const { url, state } = await oidcClient.getAuthorizationUrl();
  console.log('Visit this URL to authenticate:', url);

  // 2) When the user returns from the authorization server with a code,
  //    call handleRedirect with the code and state.
  //
  //    This context object (IStoreContext) must include request & response
  //    objects so the session can be started/stored.
  //
  //    For example, in an Express-based app, you might do:
  //    const context = { request: req, response: res };

  await oidcClient.handleRedirect('the-auth-code', state, {
    request: mockRequest,
    response: mockResponse,
  });

  // 3) Retrieve user info
  const userInfo = await oidcClient.getUserInfo();
  console.log('User Info:', userInfo);

  // 4) You can now retrieve tokens on subsequent requests, introspect, etc.
  const accessToken = await oidcClient.getAccessToken();
  console.log('Access Token:', accessToken);
})();
```

### Session Management

By default, the client uses an in-memory session store (StorageMechanism.MEMORY). For cookie-based session management—useful when running in stateless environments—you can set:

```typescript
session: {
  mechanism: StorageMechanism.COOKIE,
  cookie: {
    name: 'oidcSession',
    options: {
      secure: true,
      httpOnly: true,
      sameSite: SameSite.STRICT,
      path: '/',
      maxAge: 3600,
    },
  },
},
```

Your request and response objects must be passed to the relevant methods (such as _handleRedirect_) so the session can be created, updated, or destroyed.

#### Custom Session Store

You may also implement your own session store by conforming to the ISessionStore interface and injecting it via the session.store property.

### Token Management

Retrieve, introspect, or revoke tokens with ease:

```typescript
// Get the current Access Token (refreshes automatically if needed)
const accessToken = await oidcClient.getAccessToken();
console.log('Access Token:', accessToken);

// Clear stored tokens
await oidcClient.clearTokens({ request, response });
console.log('Tokens cleared.');
```

### Device Authorization Flow

Suitable for devices or environments with limited input capabilities:

```typescript
// Step 1: Start device authorization
const { device_code, user_code, verification_uri } =
  await oidcClient.startDeviceAuthorization();

console.log(`Please go to ${verification_uri} and enter the code ${user_code}`);

// Step 2: Poll for device token
// Provide an optional context if you need to start a session upon success
await oidcClient.pollDeviceToken(
  device_code,
  /* interval */ 5,
  /* timeout */ 60000,
  {
    request: mockRequest,
    response: mockResponse,
  },
);

console.log('Device successfully authorized!');

// Now you can fetch tokens or user info
const tokens = await oidcClient.getTokens();
console.log('Tokens:', tokens);
```

### Token Introspection and Revocation

```typescript
// Introspect a token
const introspection = await oidcClient.introspectToken('some-access-token');
console.log('Token introspection result:', introspection);

// Revoke a token (access or refresh)
await oidcClient.revokeToken('some-refresh-token', 'refresh_token');
console.log('Token revoked.');
```

### Logout

To initiate the OIDC logout flow (often used to sign the user out of the identity provider session):

```typescript
const logoutUrl = await oidcClient.logout(/* optional idTokenHint */);
console.log('Logout URL:', logoutUrl);

// Typically, you would redirect the user to this URL:
res.redirect(logoutUrl);
```

### Logging

Customize the logging level:

```typescript
oidcClient.setLogLevel('debug');
```

## Configuration Options

Below are the required and optional parameters for initializing the `Client`:

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

**note** - The client accepts additonal options for customizing the OIDC flow, such as `responseType`, `responseMode`, `prompt`, `nonce`, and `state` etc. These options can be configured by adhereing to the `ICl

## API Reference

### Methods

- `getAuthorizationUrl()` - Generates an authorization URL for user login.
- `handleRedirect(code, state, context)` - Processes the callback from the authorization server.
  - `code` - Authorization code from the callback.
  - `state` - State value from the callback.
  - `context` - An object containing your request and response (for session handling).
- `handleRedirectForImplicitFlow(fragment, context)` - Processes the implicit flow callback.
- `getUserInfo()` - Fetches user info from the userinfo endpoint.
- `getAccessToken()` - Retrieves the current access token, refreshing it if necessary.
- `clearTokens()` - Clears all stored tokens.
- `startDeviceAuthorization()` - Initiates device authorization flow.
- `pollDeviceToken(device_code, interval, timeout)` - Polls for tokens in device authorization flow.
- `introspectToken(token)` - Introspects a token.
- `revokeToken(token, tokenTypeHint)` - Revokes a token.
- `setLogLevel(level)` - Sets the log level.
- `logout(idTokenHint?)` - Initiates the OIDC logout flow.

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
