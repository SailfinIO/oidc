## [0.1.0](https://github.com/SailfinIO/oidc/compare/v0.0.14...v0.1.0) (2025-06-18)

### Features

* add key utilities ([e5e9cbc](https://github.com/SailfinIO/oidc/commit/e5e9cbc551d5344756a151194b3234ff72636524))

### Bug Fixes

* add client and decorators ([785e93c](https://github.com/SailfinIO/oidc/commit/785e93c74cb2400211e72e2006e0739f32404add))
* add container class ([4b71e5b](https://github.com/SailfinIO/oidc/commit/4b71e5b442091ba871ecc134b43760c49bf62dba))
* add fallback for session setting ([9ab570e](https://github.com/SailfinIO/oidc/commit/9ab570ebdb66d9db3083d2e5682be2e8d90129c2))
* add fallbacks for session management ([3ead712](https://github.com/SailfinIO/oidc/commit/3ead712a71ea1fa5cbf9dbe47ab9a71166645cd9))
* add logout decorator and debug logs ([1e861b2](https://github.com/SailfinIO/oidc/commit/1e861b21b3c585321efb1c2707af4a2a67464ecd))
* add Reflect define Metada ([3016e67](https://github.com/SailfinIO/oidc/commit/3016e67bef59de20b2cb1080534f1d565774d086))
* add Reflect define Metada ([2a13137](https://github.com/SailfinIO/oidc/commit/2a13137529b6799f718eb0bbb80c884e8a61d7c6))
* add silent-login flag for login decorator ([dbb4a8d](https://github.com/SailfinIO/oidc/commit/dbb4a8d6f7d594d22f834af902aca7e76aeecbfb))
* add some defaults and checks ([97e5571](https://github.com/SailfinIO/oidc/commit/97e55715037d36eeed832000a392373a6eb1b0b3))
* arg check ([8724d06](https://github.com/SailfinIO/oidc/commit/8724d069a78f9a17b42da5411517a15c1ae945b3))
* cert creation logic ([8b5e42d](https://github.com/SailfinIO/oidc/commit/8b5e42d87c347d78d5f7853d41e17109df0e0aa5))
* check for cookie in session ([384af83](https://github.com/SailfinIO/oidc/commit/384af83d933f3a241227f2715ce98ec306ee2950))
* check for missing res ([e05f8ea](https://github.com/SailfinIO/oidc/commit/e05f8eaa56c3305d0e3559c18b489cfe0c10ea47))
* check for plain objects ([12233ba](https://github.com/SailfinIO/oidc/commit/12233baa291b102ad74348022e48bdd6eaaf3ca4))
* check for plain req ([142d604](https://github.com/SailfinIO/oidc/commit/142d604c8cbd470ee90f35c7543d085a488e3bd7))
* create provider and dynamic module ([ecb1ba3](https://github.com/SailfinIO/oidc/commit/ecb1ba325f0cc5738ef099919bc9cbbd2fab141b))
* create provider scope ([142efde](https://github.com/SailfinIO/oidc/commit/142efde66b3ef72be3816dd7a3684fb586ee785c))
* deep merge in client config ([7fe2ff9](https://github.com/SailfinIO/oidc/commit/7fe2ff9a238216365e12ee0a3abdd325421db06a))
* default logger assignment in mutex ([9110a53](https://github.com/SailfinIO/oidc/commit/9110a538fc33ee02ef947fd3cdd73b1f5795d227))
* defaults ([ff94071](https://github.com/SailfinIO/oidc/commit/ff9407172537356e8496b163690d8b5441b8a862))
* DynamicModule, Provider, and usage in SailfinModule ([3bf0ff4](https://github.com/SailfinIO/oidc/commit/3bf0ff44a3f6560a9edd3724569d29a18f6a3fa5))
* ensure logging ([d7b5136](https://github.com/SailfinIO/oidc/commit/d7b5136a6e0825283751255c86fffedd70607b1c))
* export constants ([3569774](https://github.com/SailfinIO/oidc/commit/35697740709de0aa9ab0f3016868b15150f65d2e))
* export the SailfinClientModule ([4580f4e](https://github.com/SailfinIO/oidc/commit/4580f4ecce7a505b6729b02ff229fcc266a646a2))
* handle passport session ([d7ee9db](https://github.com/SailfinIO/oidc/commit/d7ee9db16496219c1bce9e806f1b5c4ff0e6f645))
* ignore static files ([e23283d](https://github.com/SailfinIO/oidc/commit/e23283d3e43e0d147e6cf7b9b1dff130c9b9082f))
* inclue missing nestjs compatible properties ([688eef1](https://github.com/SailfinIO/oidc/commit/688eef1315cd5c2063c543de7f604cb5ee7b20fd))
* injection decorators ([5643e78](https://github.com/SailfinIO/oidc/commit/5643e78b6cdd844a84d6a969ba37d82a681fe1a4))
* jwk support ([a991131](https://github.com/SailfinIO/oidc/commit/a9911317ea936887ed1a000ad28c66b7b7495c94))
* provide default algorithm ([1b530fe](https://github.com/SailfinIO/oidc/commit/1b530fe9bd64aae3033374126b22b7d57aa4d838))
* recreate rsa cert ([1aafeff](https://github.com/SailfinIO/oidc/commit/1aafeffee103ac877f079ca5359cd2f0ac8ebfaf))
* refactor protect decorator ([5f5f92b](https://github.com/SailfinIO/oidc/commit/5f5f92b1e5794d58495bf8d86a0bd5d05e1a04f6))
* refresh token ([0aa603d](https://github.com/SailfinIO/oidc/commit/0aa603dfa44920c3040ca4433b86fc8a7dec07ae))
* remove doc upload temporarily ([2a989d2](https://github.com/SailfinIO/oidc/commit/2a989d278c73d8665293b1ae0554a8ca8814a857))
* remove rsa becuase of git capitalization ([2097432](https://github.com/SailfinIO/oidc/commit/20974323a94114abd5fc2ac49b9e53878857ebef))
* remove unused imports ([e283618](https://github.com/SailfinIO/oidc/commit/e283618b5d37c23f4b021bd9d6712397738da724))
* rename default sid ([1aec1fd](https://github.com/SailfinIO/oidc/commit/1aec1fd918bb4e8a5e75187f3e725e56eebf44d8))
* request and response ([5c30592](https://github.com/SailfinIO/oidc/commit/5c3059236c09a35e557ff1bd13436a26d24140cc))
* request object and related code ([6c49b76](https://github.com/SailfinIO/oidc/commit/6c49b76cf15a679f2aed1d5d098a76f52181c2a0))
* response implementation ([5d25b07](https://github.com/SailfinIO/oidc/commit/5d25b07057b731d5ab998677ed1cd9bb339dc692))
* test sailfin client module and provider ([a6d7377](https://github.com/SailfinIO/oidc/commit/a6d7377059752e970afce3cb2ea0535bebc3aad4))
* try local scope type ([b4fb068](https://github.com/SailfinIO/oidc/commit/b4fb06851d5b0abaa1acec4d22e9e5342eb61e4c))
* try testing for token ([e3453bb](https://github.com/SailfinIO/oidc/commit/e3453bb8ef32ed0ff9c690cbc70a718b53705140))
* try without reflection ([e7d97ba](https://github.com/SailfinIO/oidc/commit/e7d97ba9fbddc287510fa59bc39ad7ab250bc999))
* use RSACertificate ([63ea877](https://github.com/SailfinIO/oidc/commit/63ea8776b0f0d320c41a952fa0702500a2731292))
* use sha256 ([a884a1b](https://github.com/SailfinIO/oidc/commit/a884a1bc464d7fcad10b1f60efff85fabd44d330))
* use sha256 ([d03f297](https://github.com/SailfinIO/oidc/commit/d03f2976943af09acd935d3e1944fa4b4d8260ce))

## [0.1.0-beta.18](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.17...v0.1.0-beta.18) (2025-01-24)

### Bug Fixes

* add container class ([4b71e5b](https://github.com/SailfinIO/oidc/commit/4b71e5b442091ba871ecc134b43760c49bf62dba))

## [0.1.0-beta.17](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.16...v0.1.0-beta.17) (2025-01-23)

### Bug Fixes

* add client and decorators ([785e93c](https://github.com/SailfinIO/oidc/commit/785e93c74cb2400211e72e2006e0739f32404add))

## [0.1.0-beta.16](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.15...v0.1.0-beta.16) (2025-01-23)

### Bug Fixes

* injection decorators ([5643e78](https://github.com/SailfinIO/oidc/commit/5643e78b6cdd844a84d6a969ba37d82a681fe1a4))

## [0.1.0-beta.15](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.14...v0.1.0-beta.15) (2025-01-23)

### Bug Fixes

* request and response ([5c30592](https://github.com/SailfinIO/oidc/commit/5c3059236c09a35e557ff1bd13436a26d24140cc))

## [0.1.0-beta.14](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.13...v0.1.0-beta.14) (2025-01-23)

### Bug Fixes

* check for plain req ([142d604](https://github.com/SailfinIO/oidc/commit/142d604c8cbd470ee90f35c7543d085a488e3bd7))

## [0.1.0-beta.13](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.12...v0.1.0-beta.13) (2025-01-23)

### Bug Fixes

* ignore static files ([e23283d](https://github.com/SailfinIO/oidc/commit/e23283d3e43e0d147e6cf7b9b1dff130c9b9082f))
* remove doc upload temporarily ([2a989d2](https://github.com/SailfinIO/oidc/commit/2a989d278c73d8665293b1ae0554a8ca8814a857))

## [0.1.0-beta.12](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.11...v0.1.0-beta.12) (2025-01-23)

### Bug Fixes

* check for plain objects ([12233ba](https://github.com/SailfinIO/oidc/commit/12233baa291b102ad74348022e48bdd6eaaf3ca4))

## [0.1.0-beta.11](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.10...v0.1.0-beta.11) (2025-01-23)

### Bug Fixes

* ensure logging ([d7b5136](https://github.com/SailfinIO/oidc/commit/d7b5136a6e0825283751255c86fffedd70607b1c))

## [0.1.0-beta.10](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.9...v0.1.0-beta.10) (2025-01-23)

### Bug Fixes

* request object and related code ([6c49b76](https://github.com/SailfinIO/oidc/commit/6c49b76cf15a679f2aed1d5d098a76f52181c2a0))

## [0.1.0-beta.9](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.8...v0.1.0-beta.9) (2025-01-23)

### Bug Fixes

* default logger assignment in mutex ([9110a53](https://github.com/SailfinIO/oidc/commit/9110a538fc33ee02ef947fd3cdd73b1f5795d227))

## [0.1.0-beta.8](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.7...v0.1.0-beta.8) (2025-01-23)

### Bug Fixes

* deep merge in client config ([7fe2ff9](https://github.com/SailfinIO/oidc/commit/7fe2ff9a238216365e12ee0a3abdd325421db06a))
* response implementation ([5d25b07](https://github.com/SailfinIO/oidc/commit/5d25b07057b731d5ab998677ed1cd9bb339dc692))

## [0.1.0-beta.7](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.6...v0.1.0-beta.7) (2025-01-23)

### Bug Fixes

* add some defaults and checks ([97e5571](https://github.com/SailfinIO/oidc/commit/97e55715037d36eeed832000a392373a6eb1b0b3))

## [0.1.0-beta.6](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.5...v0.1.0-beta.6) (2025-01-22)

### Bug Fixes

* handle passport session ([d7ee9db](https://github.com/SailfinIO/oidc/commit/d7ee9db16496219c1bce9e806f1b5c4ff0e6f645))

## [0.1.0-beta.5](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.4...v0.1.0-beta.5) (2025-01-22)

### Bug Fixes

* rename default sid ([1aec1fd](https://github.com/SailfinIO/oidc/commit/1aec1fd918bb4e8a5e75187f3e725e56eebf44d8))

## [0.1.0-beta.4](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.3...v0.1.0-beta.4) (2025-01-22)

### Bug Fixes

* cert creation logic ([8b5e42d](https://github.com/SailfinIO/oidc/commit/8b5e42d87c347d78d5f7853d41e17109df0e0aa5))

## [0.1.0-beta.3](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.2...v0.1.0-beta.3) (2025-01-20)

### Bug Fixes

* provide default algorithm ([1b530fe](https://github.com/SailfinIO/oidc/commit/1b530fe9bd64aae3033374126b22b7d57aa4d838))

## [0.1.0-beta.2](https://github.com/SailfinIO/oidc/compare/v0.1.0-beta.1...v0.1.0-beta.2) (2025-01-20)

### Bug Fixes

* jwk support ([a991131](https://github.com/SailfinIO/oidc/commit/a9911317ea936887ed1a000ad28c66b7b7495c94))
* recreate rsa cert ([1aafeff](https://github.com/SailfinIO/oidc/commit/1aafeffee103ac877f079ca5359cd2f0ac8ebfaf))
* remove rsa becuase of git capitalization ([2097432](https://github.com/SailfinIO/oidc/commit/20974323a94114abd5fc2ac49b9e53878857ebef))
* remove unused imports ([e283618](https://github.com/SailfinIO/oidc/commit/e283618b5d37c23f4b021bd9d6712397738da724))
* use RSACertificate ([63ea877](https://github.com/SailfinIO/oidc/commit/63ea8776b0f0d320c41a952fa0702500a2731292))
* use sha256 ([a884a1b](https://github.com/SailfinIO/oidc/commit/a884a1bc464d7fcad10b1f60efff85fabd44d330))
* use sha256 ([d03f297](https://github.com/SailfinIO/oidc/commit/d03f2976943af09acd935d3e1944fa4b4d8260ce))

## [0.1.0-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.21...v0.1.0-beta.1) (2025-01-20)

### Features

* add key utilities ([e5e9cbc](https://github.com/SailfinIO/oidc/commit/e5e9cbc551d5344756a151194b3234ff72636524))

## [0.0.15-beta.21](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.20...v0.0.15-beta.21) (2025-01-18)

### Bug Fixes

* refresh token ([0aa603d](https://github.com/SailfinIO/oidc/commit/0aa603dfa44920c3040ca4433b86fc8a7dec07ae))

## [0.0.15-beta.20](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.19...v0.0.15-beta.20) (2025-01-18)

### Bug Fixes

* check for cookie in session ([384af83](https://github.com/SailfinIO/oidc/commit/384af83d933f3a241227f2715ce98ec306ee2950))

## [0.0.15-beta.19](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.18...v0.0.15-beta.19) (2025-01-18)

### Bug Fixes

* try testing for token ([e3453bb](https://github.com/SailfinIO/oidc/commit/e3453bb8ef32ed0ff9c690cbc70a718b53705140))

## [0.0.15-beta.18](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.17...v0.0.15-beta.18) (2025-01-18)

### Bug Fixes

* try without reflection ([e7d97ba](https://github.com/SailfinIO/oidc/commit/e7d97ba9fbddc287510fa59bc39ad7ab250bc999))

## [0.0.15-beta.17](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.16...v0.0.15-beta.17) (2025-01-18)

### Bug Fixes

* add logout decorator and debug logs ([1e861b2](https://github.com/SailfinIO/oidc/commit/1e861b21b3c585321efb1c2707af4a2a67464ecd))

## [0.0.15-beta.16](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.15...v0.0.15-beta.16) (2025-01-17)

### Bug Fixes

* add Reflect define Metada ([3016e67](https://github.com/SailfinIO/oidc/commit/3016e67bef59de20b2cb1080534f1d565774d086))
* add Reflect define Metada ([2a13137](https://github.com/SailfinIO/oidc/commit/2a13137529b6799f718eb0bbb80c884e8a61d7c6))

## [0.0.15-beta.15](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.14...v0.0.15-beta.15) (2025-01-17)

### Bug Fixes

* arg check ([8724d06](https://github.com/SailfinIO/oidc/commit/8724d069a78f9a17b42da5411517a15c1ae945b3))

## [0.0.15-beta.14](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.13...v0.0.15-beta.14) (2025-01-17)

### Bug Fixes

* add fallback for session setting ([9ab570e](https://github.com/SailfinIO/oidc/commit/9ab570ebdb66d9db3083d2e5682be2e8d90129c2))

## [0.0.15-beta.13](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.12...v0.0.15-beta.13) (2025-01-17)

### Bug Fixes

* check for missing res ([e05f8ea](https://github.com/SailfinIO/oidc/commit/e05f8eaa56c3305d0e3559c18b489cfe0c10ea47))

## [0.0.15-beta.12](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.11...v0.0.15-beta.12) (2025-01-17)

### Bug Fixes

* refactor protect decorator ([5f5f92b](https://github.com/SailfinIO/oidc/commit/5f5f92b1e5794d58495bf8d86a0bd5d05e1a04f6))

## [0.0.15-beta.11](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.10...v0.0.15-beta.11) (2025-01-17)

### Bug Fixes

* add fallbacks for session management ([3ead712](https://github.com/SailfinIO/oidc/commit/3ead712a71ea1fa5cbf9dbe47ab9a71166645cd9))

## [0.0.15-beta.10](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.9...v0.0.15-beta.10) (2025-01-17)

### Bug Fixes

* defaults ([ff94071](https://github.com/SailfinIO/oidc/commit/ff9407172537356e8496b163690d8b5441b8a862))

## [0.0.15-beta.9](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.8...v0.0.15-beta.9) (2025-01-17)

### Bug Fixes

* add silent-login flag for login decorator ([dbb4a8d](https://github.com/SailfinIO/oidc/commit/dbb4a8d6f7d594d22f834af902aca7e76aeecbfb))

## [0.0.15-beta.8](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.7...v0.0.15-beta.8) (2025-01-17)

### Bug Fixes

* try local scope type ([b4fb068](https://github.com/SailfinIO/oidc/commit/b4fb06851d5b0abaa1acec4d22e9e5342eb61e4c))

## [0.0.15-beta.7](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.6...v0.0.15-beta.7) (2025-01-17)

### Bug Fixes

* create provider scope ([142efde](https://github.com/SailfinIO/oidc/commit/142efde66b3ef72be3816dd7a3684fb586ee785c))

## [0.0.15-beta.6](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.5...v0.0.15-beta.6) (2025-01-17)

### Bug Fixes

* DynamicModule, Provider, and usage in SailfinModule ([3bf0ff4](https://github.com/SailfinIO/oidc/commit/3bf0ff44a3f6560a9edd3724569d29a18f6a3fa5))

## [0.0.15-beta.5](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.4...v0.0.15-beta.5) (2025-01-17)

### Bug Fixes

* inclue missing nestjs compatible properties ([688eef1](https://github.com/SailfinIO/oidc/commit/688eef1315cd5c2063c543de7f604cb5ee7b20fd))

## [0.0.15-beta.4](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.3...v0.0.15-beta.4) (2025-01-17)

### Bug Fixes

* create provider and dynamic module ([ecb1ba3](https://github.com/SailfinIO/oidc/commit/ecb1ba325f0cc5738ef099919bc9cbbd2fab141b))

## [0.0.15-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.2...v0.0.15-beta.3) (2025-01-17)

### Bug Fixes

* export the SailfinClientModule ([4580f4e](https://github.com/SailfinIO/oidc/commit/4580f4ecce7a505b6729b02ff229fcc266a646a2))

## [0.0.15-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.15-beta.1...v0.0.15-beta.2) (2025-01-17)

### Bug Fixes

* export constants ([3569774](https://github.com/SailfinIO/oidc/commit/35697740709de0aa9ab0f3016868b15150f65d2e))

## [0.0.15-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.14...v0.0.15-beta.1) (2025-01-17)

### Bug Fixes

* test sailfin client module and provider ([a6d7377](https://github.com/SailfinIO/oidc/commit/a6d7377059752e970afce3cb2ea0535bebc3aad4))

## [0.0.14-beta.8](https://github.com/SailfinIO/oidc/compare/v0.0.14-beta.7...v0.0.14-beta.8) (2025-01-17)

### Bug Fixes

* test sailfin client module and provider ([a6d7377](https://github.com/SailfinIO/oidc/commit/a6d7377059752e970afce3cb2ea0535bebc3aad4))
## [0.0.14](https://github.com/SailfinIO/oidc/compare/v0.0.13...v0.0.14) (2025-01-17)

### Bug Fixes

* call original controller method if redirect uri isnt provided ([adaa05a](https://github.com/SailfinIO/oidc/commit/adaa05ac251ebc6920529f5ce7bb2d380fce1619))
* check for session sessting ([85f67ef](https://github.com/SailfinIO/oidc/commit/85f67ef2d06034db97bec8c3b4d1e57d5f87b0f6))
* check headers being sent before redirect ([3729dd8](https://github.com/SailfinIO/oidc/commit/3729dd8ba348cc0d024421b09077fae3ec07210b))
* checks for plain objects ([ebaaf09](https://github.com/SailfinIO/oidc/commit/ebaaf09857e43a2253456373a30d670d727ba4a1))
* decorator to check for session type ([2dc3298](https://github.com/SailfinIO/oidc/commit/2dc3298c4cbdb501a708aec10d2b18e51e135d34))
* handle plain objects ([fe117f4](https://github.com/SailfinIO/oidc/commit/fe117f4e92feb1069142d56521893eb14d0f6ef4))
* remove duplicate redirect ([3cec552](https://github.com/SailfinIO/oidc/commit/3cec5529b2e095f309ec9d567c215a63b7929329))
* use custom response and request ([b7b2369](https://github.com/SailfinIO/oidc/commit/b7b2369e4e76359ee856b5b5113a81d4a352c8ad))
## [0.0.14-beta.7](https://github.com/SailfinIO/oidc/compare/v0.0.14-beta.6...v0.0.14-beta.7) (2025-01-17)

### Bug Fixes

* call original controller method if redirect uri isnt provided ([adaa05a](https://github.com/SailfinIO/oidc/commit/adaa05ac251ebc6920529f5ce7bb2d380fce1619))

## [0.0.14-beta.6](https://github.com/SailfinIO/oidc/compare/v0.0.14-beta.5...v0.0.14-beta.6) (2025-01-17)

### Bug Fixes

* check headers being sent before redirect ([3729dd8](https://github.com/SailfinIO/oidc/commit/3729dd8ba348cc0d024421b09077fae3ec07210b))
* remove duplicate redirect ([3cec552](https://github.com/SailfinIO/oidc/commit/3cec5529b2e095f309ec9d567c215a63b7929329))

## [0.0.14-beta.5](https://github.com/SailfinIO/oidc/compare/v0.0.14-beta.4...v0.0.14-beta.5) (2025-01-17)

### Bug Fixes

* decorator to check for session type ([2dc3298](https://github.com/SailfinIO/oidc/commit/2dc3298c4cbdb501a708aec10d2b18e51e135d34))

## [0.0.14-beta.4](https://github.com/SailfinIO/oidc/compare/v0.0.14-beta.3...v0.0.14-beta.4) (2025-01-16)

### Bug Fixes

* check for session sessting ([85f67ef](https://github.com/SailfinIO/oidc/commit/85f67ef2d06034db97bec8c3b4d1e57d5f87b0f6))

## [0.0.14-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.14-beta.2...v0.0.14-beta.3) (2025-01-16)

### Bug Fixes

* checks for plain objects ([ebaaf09](https://github.com/SailfinIO/oidc/commit/ebaaf09857e43a2253456373a30d670d727ba4a1))

## [0.0.14-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.14-beta.1...v0.0.14-beta.2) (2025-01-16)

### Bug Fixes

* handle plain objects ([fe117f4](https://github.com/SailfinIO/oidc/commit/fe117f4e92feb1069142d56521893eb14d0f6ef4))

## [0.0.14-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.13...v0.0.14-beta.1) (2025-01-16)

### Bug Fixes

* use custom response and request ([b7b2369](https://github.com/SailfinIO/oidc/commit/b7b2369e4e76359ee856b5b5113a81d4a352c8ad))

## [0.0.13-beta.7](https://github.com/SailfinIO/oidc/compare/v0.0.13-beta.6...v0.0.13-beta.7) (2025-01-16)

### Bug Fixes

* use custom response and request ([b7b2369](https://github.com/SailfinIO/oidc/commit/b7b2369e4e76359ee856b5b5113a81d4a352c8ad))
## [0.0.13](https://github.com/SailfinIO/oidc/compare/v0.0.12...v0.0.13) (2025-01-16)

* add additional mutex tests ([1c2ed88](https://github.com/SailfinIO/oidc/commit/1c2ed885d936cc9200fb316b9fadea21b5191c96))
* add properties for method metadata ([c173423](https://github.com/SailfinIO/oidc/commit/c17342337cd6b3a0f1fcebdac68bf9fae7d2d79d))
* deadlocking ([92d2212](https://github.com/SailfinIO/oidc/commit/92d2212e429914e618c2e116b7b470bf8db71e41))
* decorator exports ([41a8e73](https://github.com/SailfinIO/oidc/commit/41a8e73761a1715b3adfdfebc52195eaefd99ff5))
* interface for deadlocks ([b0c2097](https://github.com/SailfinIO/oidc/commit/b0c20970aa9d86f6484af8e621dd1048ec642756))
* Mutex enhancements via decorators ([4536de2](https://github.com/SailfinIO/oidc/commit/4536de25a37c4a2816537c84bfd45b926dcc5559))
* mutex options ([1d42337](https://github.com/SailfinIO/oidc/commit/1d423370bab3ce113356e5ebf5c0319a6be3b17c))
* protected routes ([4d19956](https://github.com/SailfinIO/oidc/commit/4d199560a9685ea7cb51235304814d233b785f3d))
* testing handle queue entry ([f237ba9](https://github.com/SailfinIO/oidc/commit/f237ba92c55ae1edfac133b6062d8fa4858e1bef))

## [0.0.13-beta.6](https://github.com/SailfinIO/oidc/compare/v0.0.13-beta.5...v0.0.13-beta.6) (2025-01-16)

### Bug Fixes

* testing handle queue entry ([f237ba9](https://github.com/SailfinIO/oidc/commit/f237ba92c55ae1edfac133b6062d8fa4858e1bef))

## [0.0.13-beta.5](https://github.com/SailfinIO/oidc/compare/v0.0.13-beta.4...v0.0.13-beta.5) (2025-01-16)

### Bug Fixes

* add additional mutex tests ([1c2ed88](https://github.com/SailfinIO/oidc/commit/1c2ed885d936cc9200fb316b9fadea21b5191c96))

## [0.0.13-beta.4](https://github.com/SailfinIO/oidc/compare/v0.0.13-beta.3...v0.0.13-beta.4) (2025-01-15)

### Bug Fixes

* add properties for method metadata ([c173423](https://github.com/SailfinIO/oidc/commit/c17342337cd6b3a0f1fcebdac68bf9fae7d2d79d))
* decorator exports ([41a8e73](https://github.com/SailfinIO/oidc/commit/41a8e73761a1715b3adfdfebc52195eaefd99ff5))
* protected routes ([4d19956](https://github.com/SailfinIO/oidc/commit/4d199560a9685ea7cb51235304814d233b785f3d))

## [0.0.13-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.13-beta.2...v0.0.13-beta.3) (2025-01-15)

### Bug Fixes

* interface for deadlocks ([b0c2097](https://github.com/SailfinIO/oidc/commit/b0c20970aa9d86f6484af8e621dd1048ec642756))

## [0.0.13-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.13-beta.1...v0.0.13-beta.2) (2025-01-15)

### Bug Fixes

* deadlocking ([92d2212](https://github.com/SailfinIO/oidc/commit/92d2212e429914e618c2e116b7b470bf8db71e41))

## [0.0.13-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.12...v0.0.13-beta.1) (2025-01-15)

### Bug Fixes

* Mutex enhancements via decorators ([4536de2](https://github.com/SailfinIO/oidc/commit/4536de25a37c4a2816537c84bfd45b926dcc5559))
* mutex options ([1d42337](https://github.com/SailfinIO/oidc/commit/1d423370bab3ce113356e5ebf5c0319a6be3b17c))

## [0.0.12-beta.14](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.13...v0.0.12-beta.14) (2025-01-15)

### Bug Fixes

* Mutex enhancements via decorators ([4536de2](https://github.com/SailfinIO/oidc/commit/4536de25a37c4a2816537c84bfd45b926dcc5559))
## [0.0.12](https://github.com/SailfinIO/oidc/compare/v0.0.11...v0.0.12) (2025-01-14)

* add other express like functionality ([c6e793e](https://github.com/SailfinIO/oidc/commit/c6e793e99a28ddc395514c83601ade46ec3aeb64))
* add testing for cookie header append ([a2ca435](https://github.com/SailfinIO/oidc/commit/a2ca4355b6ed2406f75c89f61bc335543735ad2d))
* coverage ([04a8523](https://github.com/SailfinIO/oidc/commit/04a85233ca584fb578f57d540d79131371c6b4d0))
* csrf token checking ([27d1ecc](https://github.com/SailfinIO/oidc/commit/27d1ecc259e66565002a68b15490994e9298b5f9))
* debug logs ([e68c581](https://github.com/SailfinIO/oidc/commit/e68c5816537936c7c4dd0c5202f29f354e92f5e5))
* no need to include prompt ([39b3ad0](https://github.com/SailfinIO/oidc/commit/39b3ad0afa59b55f8df811d263232fe20664b896))
* parse express in callback ([c690308](https://github.com/SailfinIO/oidc/commit/c690308de31ee26bbeb24d72b632ae1780d5ee20))
* pass config into cookies ([2481cd2](https://github.com/SailfinIO/oidc/commit/2481cd2e5648488648754ec0d878b245323628af))
* patch for express ([9bc20a6](https://github.com/SailfinIO/oidc/commit/9bc20a65b7fbd06c560c39041207ac6a513a6cc5))
* README doc updates for decorator and middleware support ([0bf45ff](https://github.com/SailfinIO/oidc/commit/0bf45ff76895d7a3fe4208c92ba54fa425bac346))
* retrun correct bools ([1eb1fcc](https://github.com/SailfinIO/oidc/commit/1eb1fcc97b6dd102cc0fa7062e6d40e1a3e0c9e0))
* session handling ([9f0a283](https://github.com/SailfinIO/oidc/commit/9f0a28316efa639c3d9da1856dbf4d16712aa6f4))
* use cookie util to set header ([8801bf5](https://github.com/SailfinIO/oidc/commit/8801bf5baad12f34a467fab7b53ed0bea042be86))


## [0.0.12-beta.13](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.12...v0.0.12-beta.13) (2025-01-14)

### Bug Fixes

* README doc updates for decorator and middleware support ([0bf45ff](https://github.com/SailfinIO/oidc/commit/0bf45ff76895d7a3fe4208c92ba54fa425bac346))

## [0.0.12-beta.12](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.11...v0.0.12-beta.12) (2025-01-14)

### Bug Fixes

* retrun correct bools ([1eb1fcc](https://github.com/SailfinIO/oidc/commit/1eb1fcc97b6dd102cc0fa7062e6d40e1a3e0c9e0))

## [0.0.12-beta.11](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.10...v0.0.12-beta.11) (2025-01-14)

### Bug Fixes

* parse express in callback ([c690308](https://github.com/SailfinIO/oidc/commit/c690308de31ee26bbeb24d72b632ae1780d5ee20))

## [0.0.12-beta.10](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.9...v0.0.12-beta.10) (2025-01-14)

### Bug Fixes

* no need to include prompt ([39b3ad0](https://github.com/SailfinIO/oidc/commit/39b3ad0afa59b55f8df811d263232fe20664b896))

## [0.0.12-beta.9](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.8...v0.0.12-beta.9) (2025-01-14)

### Bug Fixes

* debug logs ([e68c581](https://github.com/SailfinIO/oidc/commit/e68c5816537936c7c4dd0c5202f29f354e92f5e5))

## [0.0.12-beta.8](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.7...v0.0.12-beta.8) (2025-01-14)

### Bug Fixes

* add other express like functionality ([c6e793e](https://github.com/SailfinIO/oidc/commit/c6e793e99a28ddc395514c83601ade46ec3aeb64))

## [0.0.12-beta.7](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.6...v0.0.12-beta.7) (2025-01-14)

### Bug Fixes

* patch for express ([9bc20a6](https://github.com/SailfinIO/oidc/commit/9bc20a65b7fbd06c560c39041207ac6a513a6cc5))

## [0.0.12-beta.6](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.5...v0.0.12-beta.6) (2025-01-14)

### Bug Fixes

* use cookie util to set header ([8801bf5](https://github.com/SailfinIO/oidc/commit/8801bf5baad12f34a467fab7b53ed0bea042be86))

## [0.0.12-beta.5](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.4...v0.0.12-beta.5) (2025-01-13)

### Bug Fixes

* csrf token checking ([27d1ecc](https://github.com/SailfinIO/oidc/commit/27d1ecc259e66565002a68b15490994e9298b5f9))

## [0.0.12-beta.4](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.3...v0.0.12-beta.4) (2025-01-13)

### Bug Fixes

* pass config into cookies ([2481cd2](https://github.com/SailfinIO/oidc/commit/2481cd2e5648488648754ec0d878b245323628af))

## [0.0.12-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.2...v0.0.12-beta.3) (2025-01-13)

### Bug Fixes

* add testing for cookie header append ([a2ca435](https://github.com/SailfinIO/oidc/commit/a2ca4355b6ed2406f75c89f61bc335543735ad2d))

## [0.0.12-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.12-beta.1...v0.0.12-beta.2) (2025-01-13)

### Bug Fixes

* coverage ([04a8523](https://github.com/SailfinIO/oidc/commit/04a85233ca584fb578f57d540d79131371c6b4d0))

## [0.0.12-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.11...v0.0.12-beta.1) (2025-01-13)

### Bug Fixes

* session handling ([9f0a283](https://github.com/SailfinIO/oidc/commit/9f0a28316efa639c3d9da1856dbf4d16712aa6f4))

## [0.0.11-beta.12](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.11...v0.0.11-beta.12) (2025-01-13)

### Bug Fixes

* session handling ([9f0a283](https://github.com/SailfinIO/oidc/commit/9f0a28316efa639c3d9da1856dbf4d16712aa6f4))
## [0.0.11](https://github.com/SailfinIO/oidc/compare/v0.0.10...v0.0.11) (2025-01-04)

### Bug Fixes

* code smells ([1a95a0f](https://github.com/SailfinIO/oidc/commit/1a95a0fb3ca8878ddd315f3be2b1cb778f6716a4))
* code smells ([9d925a3](https://github.com/SailfinIO/oidc/commit/9d925a3a79699a317beb885a9bf9b7b6c5c0c1d4))
* code smells ([cf5fde7](https://github.com/SailfinIO/oidc/commit/cf5fde73f141213077fa7d39261b2f66d70a8d3d))
* cookie header parsing ([6e32d1c](https://github.com/SailfinIO/oidc/commit/6e32d1c10a6c9fc3228687afcf3ed760b9ad328a))
* cookie parsing needed ([c169215](https://github.com/SailfinIO/oidc/commit/c1692150842c2573f8c304cb5672ac99fb9e947f))
* instantiate session before adding user ([d38bbd8](https://github.com/SailfinIO/oidc/commit/d38bbd8cc902053be92c15545e133078c4839eff))
* move session storage ([8ccd625](https://github.com/SailfinIO/oidc/commit/8ccd625a2bda18701869655d6b510c7426809fa3))
* parse cookie headers ([7c52684](https://github.com/SailfinIO/oidc/commit/7c52684f91d902c5a45326530558a2bc1661f33c))
* remove unused state deletion ([c511e0f](https://github.com/SailfinIO/oidc/commit/c511e0fda30974d82ac543700ac50b6389848bea))
* session state and code storage ([979d1a9](https://github.com/SailfinIO/oidc/commit/979d1a9536fb4b675a4dbdd6f4b561387e1a22e2))
* session state saving ([e29a24f](https://github.com/SailfinIO/oidc/commit/e29a24fbae4f0bbe85cefb96984b1630ff8235f7))
* token authentication methods needed ([6a053d1](https://github.com/SailfinIO/oidc/commit/6a053d10d3fbde9f3ff661347522e37a04a20079))

## [0.0.11-beta.11](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.10...v0.0.11-beta.11) (2025-01-04)

### Bug Fixes

* code smells ([1a95a0f](https://github.com/SailfinIO/oidc/commit/1a95a0fb3ca8878ddd315f3be2b1cb778f6716a4))

## [0.0.11-beta.10](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.9...v0.0.11-beta.10) (2025-01-04)

### Bug Fixes

* remove unused state deletion ([c511e0f](https://github.com/SailfinIO/oidc/commit/c511e0fda30974d82ac543700ac50b6389848bea))

## [0.0.11-beta.9](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.8...v0.0.11-beta.9) (2025-01-04)

### Bug Fixes

* instantiate session before adding user ([d38bbd8](https://github.com/SailfinIO/oidc/commit/d38bbd8cc902053be92c15545e133078c4839eff))

## [0.0.11-beta.8](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.7...v0.0.11-beta.8) (2025-01-04)

### Bug Fixes

* parse cookie headers ([7c52684](https://github.com/SailfinIO/oidc/commit/7c52684f91d902c5a45326530558a2bc1661f33c))

## [0.0.11-beta.7](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.6...v0.0.11-beta.7) (2025-01-04)

### Bug Fixes

* move session storage ([8ccd625](https://github.com/SailfinIO/oidc/commit/8ccd625a2bda18701869655d6b510c7426809fa3))

## [0.0.11-beta.6](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.5...v0.0.11-beta.6) (2025-01-04)

### Bug Fixes

* session state and code storage ([979d1a9](https://github.com/SailfinIO/oidc/commit/979d1a9536fb4b675a4dbdd6f4b561387e1a22e2))

## [0.0.11-beta.5](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.4...v0.0.11-beta.5) (2025-01-04)

### Bug Fixes

* session state saving ([e29a24f](https://github.com/SailfinIO/oidc/commit/e29a24fbae4f0bbe85cefb96984b1630ff8235f7))

## [0.0.11-beta.4](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.3...v0.0.11-beta.4) (2025-01-04)

### Bug Fixes

* cookie header parsing ([6e32d1c](https://github.com/SailfinIO/oidc/commit/6e32d1c10a6c9fc3228687afcf3ed760b9ad328a))

## [0.0.11-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.2...v0.0.11-beta.3) (2025-01-04)

### Bug Fixes

* code smells ([9d925a3](https://github.com/SailfinIO/oidc/commit/9d925a3a79699a317beb885a9bf9b7b6c5c0c1d4))
* cookie parsing needed ([c169215](https://github.com/SailfinIO/oidc/commit/c1692150842c2573f8c304cb5672ac99fb9e947f))

## [0.0.11-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.11-beta.1...v0.0.11-beta.2) (2025-01-04)

### Bug Fixes

* code smells ([cf5fde7](https://github.com/SailfinIO/oidc/commit/cf5fde73f141213077fa7d39261b2f66d70a8d3d))

## [0.0.11-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.10...v0.0.11-beta.1) (2025-01-04)

### Bug Fixes

* token authentication methods needed ([6a053d1](https://github.com/SailfinIO/oidc/commit/6a053d10d3fbde9f3ff661347522e37a04a20079))

## [0.0.10-beta.10](https://github.com/SailfinIO/oidc/compare/v0.0.10-beta.9...v0.0.10-beta.10) (2025-01-04)

### Bug Fixes

* token authentication methods needed ([6a053d1](https://github.com/SailfinIO/oidc/commit/6a053d10d3fbde9f3ff661347522e37a04a20079))

## [0.0.10](https://github.com/SailfinIO/oidc/compare/v0.0.9...v0.0.10) (2025-01-03)

### Bug Fixes

* add error handling for middleware ([17998cd](https://github.com/SailfinIO/oidc/commit/17998cde96c400e9812058e2b4266c661f936847))
* change to claims instead of scopes ([0b90bc6](https://github.com/SailfinIO/oidc/commit/0b90bc6ab5268523f34539266c70168b27490320))
* code smells ([0536fde](https://github.com/SailfinIO/oidc/commit/0536fde9f6ce0389d7f0832b75fb34f9a7b3f0d7))
* decorators testing ([0621d72](https://github.com/SailfinIO/oidc/commit/0621d729195ba88f39e59426eff2f526a6a11b33))
* export oidc login and callback ([335b3ff](https://github.com/SailfinIO/oidc/commit/335b3ff435153654a37df7673c8631ee112c8b6f))
* file name ([4eedaa4](https://github.com/SailfinIO/oidc/commit/4eedaa48d97b812e2c7d5c548322a4a6dce3e4db))
* headers as plain object ([2deca91](https://github.com/SailfinIO/oidc/commit/2deca91b36ae2e3c222c924b34ee9df496430835))
* metadata manager initialization and login/callback decorators ([9b2256c](https://github.com/SailfinIO/oidc/commit/9b2256c3dcac2531e123e05a28fbb5120726e1e3))
* middleware handling ([0af7430](https://github.com/SailfinIO/oidc/commit/0af7430144f05e4a8cda14388baa02ff033bf479))
* optional logger ([b82e53b](https://github.com/SailfinIO/oidc/commit/b82e53bfb604170d76d0686c66e9f111fd7ec359))
* remove redundant interface ([7fac0a8](https://github.com/SailfinIO/oidc/commit/7fac0a81557e4e698c98f7c9b4eb763730a65370))
* work on claims ([8fe05d1](https://github.com/SailfinIO/oidc/commit/8fe05d111c70482c070ad635d94b31256347ee87))
* work on session state ([6f7c95b](https://github.com/SailfinIO/oidc/commit/6f7c95b2a28daeb0ad1586de2a4ef81347672785))


## [0.0.10-beta.9](https://github.com/SailfinIO/oidc/compare/v0.0.10-beta.8...v0.0.10-beta.9) (2025-01-03)

### Bug Fixes

* metadata manager initialization and login/callback decorators ([9b2256c](https://github.com/SailfinIO/oidc/commit/9b2256c3dcac2531e123e05a28fbb5120726e1e3))

## [0.0.10-beta.8](https://github.com/SailfinIO/oidc/compare/v0.0.10-beta.7...v0.0.10-beta.8) (2025-01-03)

### Bug Fixes

* optional logger ([b82e53b](https://github.com/SailfinIO/oidc/commit/b82e53bfb604170d76d0686c66e9f111fd7ec359))

## [0.0.10-beta.7](https://github.com/SailfinIO/oidc/compare/v0.0.10-beta.6...v0.0.10-beta.7) (2025-01-03)

### Bug Fixes

* export oidc login and callback ([335b3ff](https://github.com/SailfinIO/oidc/commit/335b3ff435153654a37df7673c8631ee112c8b6f))

## [0.0.10-beta.6](https://github.com/SailfinIO/oidc/compare/v0.0.10-beta.5...v0.0.10-beta.6) (2025-01-03)

### Bug Fixes

* headers as plain object ([2deca91](https://github.com/SailfinIO/oidc/commit/2deca91b36ae2e3c222c924b34ee9df496430835))

## [0.0.10-beta.5](https://github.com/SailfinIO/oidc/compare/v0.0.10-beta.4...v0.0.10-beta.5) (2025-01-03)

### Bug Fixes

* middleware handling ([0af7430](https://github.com/SailfinIO/oidc/commit/0af7430144f05e4a8cda14388baa02ff033bf479))

## [0.0.10-beta.4](https://github.com/SailfinIO/oidc/compare/v0.0.10-beta.3...v0.0.10-beta.4) (2025-01-02)

### Bug Fixes

* add error handling for middleware ([17998cd](https://github.com/SailfinIO/oidc/commit/17998cde96c400e9812058e2b4266c661f936847))

## [0.0.10-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.10-beta.2...v0.0.10-beta.3) (2025-01-02)

### Bug Fixes

* change to claims instead of scopes ([0b90bc6](https://github.com/SailfinIO/oidc/commit/0b90bc6ab5268523f34539266c70168b27490320))

## [0.0.10-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.10-beta.1...v0.0.10-beta.2) (2025-01-02)

### Bug Fixes

* code smells ([0536fde](https://github.com/SailfinIO/oidc/commit/0536fde9f6ce0389d7f0832b75fb34f9a7b3f0d7))

## [0.0.10-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.9...v0.0.10-beta.1) (2025-01-02)

### Bug Fixes

* decorators testing ([0621d72](https://github.com/SailfinIO/oidc/commit/0621d729195ba88f39e59426eff2f526a6a11b33))
* file name ([4eedaa4](https://github.com/SailfinIO/oidc/commit/4eedaa48d97b812e2c7d5c548322a4a6dce3e4db))
* remove redundant interface ([7fac0a8](https://github.com/SailfinIO/oidc/commit/7fac0a81557e4e698c98f7c9b4eb763730a65370))
* work on claims ([8fe05d1](https://github.com/SailfinIO/oidc/commit/8fe05d111c70482c070ad635d94b31256347ee87))
* work on session state ([6f7c95b](https://github.com/SailfinIO/oidc/commit/6f7c95b2a28daeb0ad1586de2a4ef81347672785))

## [0.0.9-beta.4](https://github.com/SailfinIO/oidc/compare/v0.0.9-beta.3...v0.0.9-beta.4) (2024-12-28)

### Bug Fixes

* decorators testing ([0621d72](https://github.com/SailfinIO/oidc/commit/0621d729195ba88f39e59426eff2f526a6a11b33))

## [0.0.9-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.9-beta.2...v0.0.9-beta.3) (2024-12-27)

### Bug Fixes

* coverage ([f3e2520](https://github.com/SailfinIO/oidc/commit/f3e2520c776a3a56201a0d4137e2555f0d292884))
* covereage for url and mutex ([16993e9](https://github.com/SailfinIO/oidc/commit/16993e902c15868f1aa990cb41a808bbd6c625e0))
* covereage for url and mutex ([705c941](https://github.com/SailfinIO/oidc/commit/705c9416d5930bf47903813002eebe418a51d7ae))

## [0.0.9-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.9-beta.1...v0.0.9-beta.2) (2024-12-27)

### Bug Fixes

* auth tests ([2a84a90](https://github.com/SailfinIO/oidc/commit/2a84a90570830b17981844408e24e87369c2c87f))
* code smells ([2431889](https://github.com/SailfinIO/oidc/commit/2431889d7ab1b61ebafd6046874a365d03d1a546))
* coverage for quality gate ([4e78493](https://github.com/SailfinIO/oidc/commit/4e78493a78fe909f3d1bdfbfa37933e72ce1df9f))

## [0.0.9-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.8...v0.0.9-beta.1) (2024-12-27)

### Bug Fixes

* acr and uilocales support ([a24c4ff](https://github.com/SailfinIO/oidc/commit/a24c4ff846a6ffad7acacaa186a64580768bc481))
* testing auth ([947a9aa](https://github.com/SailfinIO/oidc/commit/947a9aa495d3ccba9ed5f144a60e48c950f72578))

## [0.0.8-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.8-beta.1...v0.0.8-beta.2) (2024-12-27)

### Bug Fixes

* acr and uilocales support ([a24c4ff](https://github.com/SailfinIO/oidc/commit/a24c4ff846a6ffad7acacaa186a64580768bc481))
* testing auth ([947a9aa](https://github.com/SailfinIO/oidc/commit/947a9aa495d3ccba9ed5f144a60e48c950f72578))
## [0.0.8](https://github.com/SailfinIO/oidc/compare/v0.0.7...v0.0.8) (2024-12-27)

### Bug Fixes

* code smells ([babdee5](https://github.com/SailfinIO/oidc/commit/babdee5ca0c385e58f36e981599334bd63762fd5))

## [0.0.8-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.7...v0.0.8-beta.1) (2024-12-27)

### Bug Fixes

* code smells ([babdee5](https://github.com/SailfinIO/oidc/commit/babdee5ca0c385e58f36e981599334bd63762fd5))

## [0.0.7-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.7-beta.1...v0.0.7-beta.2) (2024-12-27)

### Bug Fixes

* code smells ([babdee5](https://github.com/SailfinIO/oidc/commit/babdee5ca0c385e58f36e981599334bd63762fd5))

## [0.0.7-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.6...v0.0.7-beta.1) (2024-12-27)

### Bug Fixes

* docs deployment and readme usage error ([914f9ae](https://github.com/SailfinIO/oidc/commit/914f9ae517386dde8c62309794909d64d1a31917))

## [0.0.6-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.6-beta.1...v0.0.6-beta.2) (2024-12-27)

### Bug Fixes

* docs deployment and readme usage error ([914f9ae](https://github.com/SailfinIO/oidc/commit/914f9ae517386dde8c62309794909d64d1a31917))
## [0.0.6](https://github.com/SailfinIO/oidc/compare/v0.0.5...v0.0.6) (2024-12-27)

### Bug Fixes

* case-sensitive filename for Cookie.ts ([6a79239](https://github.com/SailfinIO/oidc/commit/6a79239bc5a99d286a074a41d828b39b6c001b3a))
* code smells and workflow branch deploy ([648201d](https://github.com/SailfinIO/oidc/commit/648201de08a8be1c50d4a64ced2e14b31b555e07))
* failing tests around session management ([07d5320](https://github.com/SailfinIO/oidc/commit/07d5320bd63b6a4cff1331bc4a96ccc6cda2b73d))
* remove unused session util ([e02a3f3](https://github.com/SailfinIO/oidc/commit/e02a3f36539c84c69ef211d9daaa8fcc40b5f0d9))
* script for typedocs ([db0f0a5](https://github.com/SailfinIO/oidc/commit/db0f0a5dfaddeed694978fbdc4e35318f864e8d0))
* session management and testing ([b04b434](https://github.com/SailfinIO/oidc/commit/b04b4340146efc5c4e74a94c9cde0ca50773d953))
* split out cookie utilities ([cb6d742](https://github.com/SailfinIO/oidc/commit/cb6d74277eafbe32750900920c63821e0cebc248))

## [0.0.6-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.5...v0.0.6-beta.1) (2024-12-27)

### Bug Fixes

* case-sensitive filename for Cookie.ts ([6a79239](https://github.com/SailfinIO/oidc/commit/6a79239bc5a99d286a074a41d828b39b6c001b3a))
* code smells and workflow branch deploy ([648201d](https://github.com/SailfinIO/oidc/commit/648201de08a8be1c50d4a64ced2e14b31b555e07))
* failing tests around session management ([07d5320](https://github.com/SailfinIO/oidc/commit/07d5320bd63b6a4cff1331bc4a96ccc6cda2b73d))
* remove unused session util ([e02a3f3](https://github.com/SailfinIO/oidc/commit/e02a3f36539c84c69ef211d9daaa8fcc40b5f0d9))
* script for typedocs ([db0f0a5](https://github.com/SailfinIO/oidc/commit/db0f0a5dfaddeed694978fbdc4e35318f864e8d0))
* session management and testing ([b04b434](https://github.com/SailfinIO/oidc/commit/b04b4340146efc5c4e74a94c9cde0ca50773d953))
* split out cookie utilities ([cb6d742](https://github.com/SailfinIO/oidc/commit/cb6d74277eafbe32750900920c63821e0cebc248))

## [0.0.5-beta.10](https://github.com/SailfinIO/oidc/compare/v0.0.5-beta.9...v0.0.5-beta.10) (2024-12-26)

### Bug Fixes

* code smells and workflow branch deploy ([648201d](https://github.com/SailfinIO/oidc/commit/648201de08a8be1c50d4a64ced2e14b31b555e07))

## [0.0.5-beta.9](https://github.com/SailfinIO/oidc/compare/v0.0.5-beta.8...v0.0.5-beta.9) (2024-12-26)

### Bug Fixes

* case-sensitive filename for Cookie.ts ([6a79239](https://github.com/SailfinIO/oidc/commit/6a79239bc5a99d286a074a41d828b39b6c001b3a))
* failing tests around session management ([07d5320](https://github.com/SailfinIO/oidc/commit/07d5320bd63b6a4cff1331bc4a96ccc6cda2b73d))
* remove unused session util ([e02a3f3](https://github.com/SailfinIO/oidc/commit/e02a3f36539c84c69ef211d9daaa8fcc40b5f0d9))
* script for typedocs ([db0f0a5](https://github.com/SailfinIO/oidc/commit/db0f0a5dfaddeed694978fbdc4e35318f864e8d0))
* session management and testing ([b04b434](https://github.com/SailfinIO/oidc/commit/b04b4340146efc5c4e74a94c9cde0ca50773d953))
## [0.0.5](https://github.com/SailfinIO/oidc/compare/v0.0.4...v0.0.5) (2024-12-24)

### Bug Fixes

* code coverage in auth client ([697ee37](https://github.com/SailfinIO/oidc/commit/697ee37ecb73df830a2b878b582b96c528dc8254))
* code smells ([215ac21](https://github.com/SailfinIO/oidc/commit/215ac21e22452a199479730f9e4146b9ec91bee1))
* code smells ([45214f5](https://github.com/SailfinIO/oidc/commit/45214f550dc4dec960815d6f9fff4591f47a0986))
* code smells ([98f705e](https://github.com/SailfinIO/oidc/commit/98f705e74f06b52397f7027bdfc146620726a204))
* more appropriate issuer discovery method ([a6e83ad](https://github.com/SailfinIO/oidc/commit/a6e83adabf7596dabfc6c1ba7ff5a1837781e7de))
* naming and exports ([dd06ec6](https://github.com/SailfinIO/oidc/commit/dd06ec6f1dbdfa855bcda68379e85850b84adca0))
* refactoring auth ([9250477](https://github.com/SailfinIO/oidc/commit/9250477953a37c108d1b06afecdf9c4a364a9638))
* testing for client ([dc90e7d](https://github.com/SailfinIO/oidc/commit/dc90e7db2d337382046ede664206affbf1e6d8d9))

## [0.0.5-beta.8](https://github.com/SailfinIO/oidc/compare/v0.0.5-beta.7...v0.0.5-beta.8) (2024-12-24)

### Bug Fixes

* code smells ([215ac21](https://github.com/SailfinIO/oidc/commit/215ac21e22452a199479730f9e4146b9ec91bee1))

## [0.0.5-beta.7](https://github.com/SailfinIO/oidc/compare/v0.0.5-beta.6...v0.0.5-beta.7) (2024-12-24)

### Bug Fixes

* testing for client ([dc90e7d](https://github.com/SailfinIO/oidc/commit/dc90e7db2d337382046ede664206affbf1e6d8d9))

## [0.0.5-beta.6](https://github.com/SailfinIO/oidc/compare/v0.0.5-beta.5...v0.0.5-beta.6) (2024-12-24)

### Bug Fixes

* code smells ([45214f5](https://github.com/SailfinIO/oidc/commit/45214f550dc4dec960815d6f9fff4591f47a0986))

## [0.0.5-beta.5](https://github.com/SailfinIO/oidc/compare/v0.0.5-beta.4...v0.0.5-beta.5) (2024-12-24)

### Bug Fixes

* code smells ([98f705e](https://github.com/SailfinIO/oidc/commit/98f705e74f06b52397f7027bdfc146620726a204))

## [0.0.5-beta.4](https://github.com/SailfinIO/oidc/compare/v0.0.5-beta.3...v0.0.5-beta.4) (2024-12-24)

### Bug Fixes

* more appropriate issuer discovery method ([a6e83ad](https://github.com/SailfinIO/oidc/commit/a6e83adabf7596dabfc6c1ba7ff5a1837781e7de))

## [0.0.5-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.5-beta.2...v0.0.5-beta.3) (2024-12-24)

### Bug Fixes

* refactoring auth ([9250477](https://github.com/SailfinIO/oidc/commit/9250477953a37c108d1b06afecdf9c4a364a9638))

## [0.0.5-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.5-beta.1...v0.0.5-beta.2) (2024-12-24)

### Bug Fixes

* naming and exports ([dd06ec6](https://github.com/SailfinIO/oidc/commit/dd06ec6f1dbdfa855bcda68379e85850b84adca0))

## [0.0.5-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.4...v0.0.5-beta.1) (2024-12-23)

### Bug Fixes

* code coverage in auth client ([697ee37](https://github.com/SailfinIO/oidc/commit/697ee37ecb73df830a2b878b582b96c528dc8254))

## [0.0.4-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.4-beta.1...v0.0.4-beta.2) (2024-12-23)

### Bug Fixes

* code coverage in auth client ([697ee37](https://github.com/SailfinIO/oidc/commit/697ee37ecb73df830a2b878b582b96c528dc8254))

### Bug Fixes

* export client ([1638482](https://github.com/SailfinIO/oidc/commit/1638482f7dc4d22059ddfbf20cd657b6ee97eb59))

## [0.0.4-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.3...v0.0.4-beta.1) (2024-12-22)

### Bug Fixes

* export client ([1638482](https://github.com/SailfinIO/oidc/commit/1638482f7dc4d22059ddfbf20cd657b6ee97eb59))

## [0.0.3-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.3-beta.2...v0.0.3-beta.3) (2024-12-22)

### Bug Fixes

* export client ([1638482](https://github.com/SailfinIO/oidc/commit/1638482f7dc4d22059ddfbf20cd657b6ee97eb59))

## [0.0.3-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.3-beta.1...v0.0.3-beta.2) (2024-12-21)

### Bug Fixes

* code smells ([8c1e76f](https://github.com/SailfinIO/oidc/commit/8c1e76fe8c61620450040d7bbc4af04a10816d3c))

## [0.0.3-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.2...v0.0.3-beta.1) (2024-12-20)

### Bug Fixes

* add coverage and fix jwks client ([fdff5e8](https://github.com/SailfinIO/oidc/commit/fdff5e80940d3e64fce8fc97e06862daf03dfa0e))
* add tests for coverage ([15d1451](https://github.com/SailfinIO/oidc/commit/15d14512a0b00eccd83200bda4bedf2f4fa4fcc2))
* additional comments and coverage ([d57c237](https://github.com/SailfinIO/oidc/commit/d57c237bcced5141b262e4cd1adcad05a6a7f188))
* expanded config options ([904fe67](https://github.com/SailfinIO/oidc/commit/904fe67ccc0395bbf0d7f94306f0feca8262c9d8))
* increase test coverage ([3722f8a](https://github.com/SailfinIO/oidc/commit/3722f8adb425831f25e5b27ca7868e0543ee2a06))

## [0.0.2-beta.6](https://github.com/SailfinIO/oidc/compare/v0.0.2-beta.5...v0.0.2-beta.6) (2024-12-20)

### Bug Fixes

* additional comments and coverage ([d57c237](https://github.com/SailfinIO/oidc/commit/d57c237bcced5141b262e4cd1adcad05a6a7f188))

## [0.0.2-beta.5](https://github.com/SailfinIO/oidc/compare/v0.0.2-beta.4...v0.0.2-beta.5) (2024-12-20)

### Bug Fixes

* add coverage and fix jwks client ([fdff5e8](https://github.com/SailfinIO/oidc/commit/fdff5e80940d3e64fce8fc97e06862daf03dfa0e))

## [0.0.2-beta.4](https://github.com/SailfinIO/oidc/compare/v0.0.2-beta.3...v0.0.2-beta.4) (2024-12-20)

### Bug Fixes

* add tests for coverage ([15d1451](https://github.com/SailfinIO/oidc/commit/15d14512a0b00eccd83200bda4bedf2f4fa4fcc2))

## [0.0.2-beta.3](https://github.com/SailfinIO/oidc/compare/v0.0.2-beta.2...v0.0.2-beta.3) (2024-12-20)

### Bug Fixes

* increase test coverage ([3722f8a](https://github.com/SailfinIO/oidc/commit/3722f8adb425831f25e5b27ca7868e0543ee2a06))

## [0.0.2-beta.2](https://github.com/SailfinIO/oidc/compare/v0.0.2-beta.1...v0.0.2-beta.2) (2024-12-19)

### Bug Fixes

* expanded config options ([904fe67](https://github.com/SailfinIO/oidc/commit/904fe67ccc0395bbf0d7f94306f0feca8262c9d8))
## [0.0.2-beta.1](https://github.com/SailfinIO/oidc/compare/v0.0.1...v0.0.2-beta.1) (2024-12-19)

### Bug Fixes

* add tests for http client ([ad2bc4b](https://github.com/SailfinIO/oidc/commit/ad2bc4b7ecee01aefcdc0dc9240663f18f969f14))
* old readme ([9fd1553](https://github.com/SailfinIO/oidc/commit/9fd15536c4af981b8ccaf4a8415f22702b81eee0))
* stringify headers ([e88e685](https://github.com/SailfinIO/oidc/commit/e88e6857d35ad5da6387c7f8863f158bcca31e66))
