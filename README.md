# ipv-cri-cic-api

Claimed Identity Collector (CIC) CRI service for GOV.UK One Login. This repository contains the CIC API, an IPV stub for end-to-end testing, and a test harness.

The CIC API is deployed to AWS using AWS SAM (`deploy/template.yaml`) as **nodejs20.x** Lambda functions (built from TypeScript in `src/`). The OpenAPI contract is `deploy/cic-spec.yaml` (OpenAPI 3.0.1).

> [!IMPORTANT]
> This repository is **public**. Do **not** commit secrets, credentials, internal URLs, account identifiers, template IDs, or sensitive configuration values. Document **names** and **purposes** only and use placeholders in examples.

---

## Table of contents
- [Quick links](#quick-links)
- [What this service does](#what-this-service-does)
- [Repository layout](#repository-layout)
- [API surface](#api-surface)
- [Getting started](#getting-started)
- [Environment file (.env)](#environment-file-env)
- [Running tests](#running-tests)
  - [Unit tests](#unit-tests)
  - [API tests](#api-tests)
  - [E2E tests](#e2e-tests)
  - [Infra tests](#infra-tests)
  - [Log and PII checks](#log-and-pii-checks)
  - [Contract (Pact) tests](#contract-pact-tests)
  - [Containerised tests against a deployed stack](#containerised-tests-against-a-deployed-stack)
- [Authentication and required headers](#authentication-and-required-headers)
- [Curl examples (sanitised)](#curl-examples-sanitised)
- [Deployment](#deployment)
  - [Dev and personal stack naming](#dev-and-personal-stack-naming)
  - [Local and ephemeral deployment (exceptional)](#local-and-ephemeral-deployment-exceptional)
- [JWKS](#jwks)
- [Code owners](#code-owners)
- [Pre-commit and security checks](#pre-commit-and-security-checks)
- [Troubleshooting](#troubleshooting)
- [Licence](#licence)

---

## Quick links
- **API contract:** `deploy/cic-spec.yaml`
- **SAM template:** `deploy/template.yaml`
- **SAM config:** `deploy/samconfig.toml`
- **Run containerised tests against a deployed stack:** `./run-tests-locally.sh <stack-name>`
- **IPV stub (for test journeys):** `cic-ipv-stub/`
- **Test harness:** `test-harness/`
- **ADRs:** `adr/`

---

## What this service does
CIC supports the “claimed identity” part of the One Login IPV journey.

At a high level it:
- Creates and manages **sessions** for users.
- Accepts and persists a user’s **claimed identity** attributes (captured by a frontend).
- Implements an OAuth2-style flow used by IPV components:
  - `GET /authorization` issues an authorization code for a session.
  - `POST /token` exchanges an authorization code for a Bearer access token (`application/x-www-form-urlencoded`).
- Provides a **userinfo** endpoint used downstream in the IPV journey.
- Publishes **JWKS** for token verification and related cryptographic operations.
- Provides operational/config endpoints (for example aborting a session, and session configuration for the frontend).

> [!TIP]
> `deploy/cic-spec.yaml` is the source of truth for request/response shapes, required headers, and error responses.

> [!NOTE]
> CIC captures claimed identity information and supports issuance/return of the CIC credential material as defined by the contract and implementation. It does **not** itself perform in-person checks.

---

## Repository layout
- `deploy/` – SAM template, OpenAPI spec, and deployment config
- `src/` – Lambda handlers and shared code (TypeScript)
- `src/tests/` – unit, API, contract, infra tests
- `cic-ipv-stub/` – IPV stub for driving journeys (test-only)
- `test-harness/` – harness utilities used in tests
- `infra-l2-*` – shared infra templates (for example Dynamo/KMS)
- `adr/` – architecture decision records

---

## API surface

> [!TIP]
> Endpoint shapes, headers, and error responses are defined in `deploy/cic-spec.yaml`.

| Path | Method | Summary |
|---|---:|---|
| `/session` | POST | Validate incoming request and create/return session material |
| `/claimedIdentity` | POST | Persist claimed identity details against the session |
| `/authorization` | GET | Issue an authorization code for the session |
| `/token` | POST | Exchange authorization code for a Bearer access token |
| `/userinfo` | POST | Userinfo endpoint (Bearer token required; see spec) |
| `/session-config` | GET | Session configuration used by frontend (see spec/template) |
| `/abort` | POST | Abort/terminate the session |
| `/.well-known/jwks.json` | GET | Publish JWKS for the service |

---

## Getting started

### Prerequisites
- Node.js version per `src/package.json` (`engines.node`)
- AWS Lambda runtime: nodejs20.x (see `deploy/template.yaml`)
- npm
- (Optional) AWS SAM CLI for building/deploying stacks
- Docker + AWS credentials (only required to run the containerised tests against a deployed stack)

### Install and run common local checks
```sh
cd src
npm ci
npm run compile
npm run lint
npm run test:unit
```

> [!NOTE]
> Lambdas run on nodejs20.x in AWS, but local development uses the Node version defined in `src/package.json`.

---

## Environment file (.env)
If `src/.env.example` is present, it documents the environment variables this project expects. If present, copy it to `.env` for local use.

```sh
cd src
cp .env.example .env
```

> [!IMPORTANT]
> Do not commit `.env` or any real secrets to this public repo.

---

## Running tests
All scripts are defined in `src/package.json`.

### Unit tests
```sh
cd src
npm run test:unit
```

### API tests
```sh
cd src
npm run test:api
```

### E2E tests
```sh
cd src
npm run test:e2e
```

### Infra tests
```sh
cd src
npm run test:infra
```

### Log and PII checks
```sh
cd src
npm run test:pii
```

### Contract (Pact) tests
This repo includes provider verification tests that validate the provider against a published Pact and (in CI) publish results to the Pact Broker. See `src/package.json` scripts for the exact workflows.

> [!IMPORTANT]
> Keep broker credentials and broker URLs out of this public repo. Document names only and use placeholders in examples.

#### Environment variables (names only)
- `PACT_BROKER_USER`
- `PACT_BROKER_PASSWORD`
- `PACT_BROKER_URL`
- `PACT_PROVIDER_NAME`
- `PACT_PROVIDER_VERSION`

#### Run contract tests (local / CI-style)
```sh
cd src
npm run test:contract:ci
```

### Containerised tests against a deployed stack
This repo includes a Docker-based runner for executing tests against a deployed stack:

- `run-tests-locally.sh`
- `run-tests.sh`
- `Dockerfile`

Run:

```sh
./run-tests-locally.sh <stack-name>
```

What it typically does:
- Queries CloudFormation outputs for the target stack and exports them as `CFN_*`.
- Writes temporary env/output files for Docker and runs tests inside a container.
- Writes results to `./results`.

> [!CAUTION]
> These runners may write AWS credential environment variables into temporary files (for example `docker_vars.env`) and may write stack outputs to files (for example `cf-output.txt`). Ensure these generated files are not committed.

> [!TIP]
> The authoritative mapping of CloudFormation outputs → test environment variables is defined in `run-tests.sh`. Document names only in public-facing docs.

---

## Authentication and required headers
Per `deploy/cic-spec.yaml`, endpoints typically rely on a combination of:
- Session headers (for example `session-id` and/or `x-govuk-signin-session-id` depending on the endpoint)
- Bearer access token for protected endpoints:

```
Authorization: Bearer <token>
```

> [!TIP]
> Confirm exact header names and `required: true` flags in `deploy/cic-spec.yaml` under each path’s `parameters:` section.

---

## Curl examples (sanitised)

> [!IMPORTANT]
> Replace placeholders. Do not add environment hostnames, real tokens, or real user data to this repo.

### POST /token (form-encoded)
```sh
curl -sS -X POST "https://<cic-base-url>/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "code=<authorization_code_uuid>" \
  --data-urlencode "redirect_uri=https://www.example.com/callback"
```

### POST /userinfo (Bearer token)
```sh
curl -sS -X POST "https://<cic-base-url>/userinfo" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### GET /.well-known/jwks.json
```sh
curl -sS "https://<cic-base-url>/.well-known/jwks.json"
```

---

## Deployment
Deployment definition/config:
- `deploy/template.yaml`
- `deploy/samconfig.toml`

The standard deployment route is via the CI/CD pipeline for this repository. Use local SAM deployments only when explicitly required by your team/process.

> [!NOTE]
> Parameter overrides and environment-specific deployment values are intentionally not documented here (public repo hygiene). Use your organisation’s internal runbooks for environment-specific instructions.

### Dev and personal stack naming
Deploy with a custom stack name (include your initials) to avoid overwriting shared stacks (for example `cic-cri-api-<initials>`).

Set the stack name in `deploy/samconfig.toml`, or provide it explicitly via `sam deploy --stack-name`.

After deploying, update the test harness SAM config in `test-harness/deploy/samconfig.toml` (if used) to reference the custom API stack name so the harness targets the correct stack.

### Local and ephemeral deployment (exceptional)
```sh
cd deploy
sam build --parallel
sam deploy --resolve-s3 --stack-name "YOUR_STACK_NAME" --confirm-changeset --config-env dev
```

---

## JWKS
JWKS is published at `/.well-known/jwks.json`. See `deploy/cic-spec.yaml` for details.

---

## Code owners
If a `CODEOWNERS` file is present at the repo root, PRs require review by code owners.

---

## Pre-commit and security checks
This repo uses pre-commit configuration:
- `.pre-commit-config.yaml`
- `.secrets.baseline`

Install hooks:

```sh
pre-commit install
```

Run hooks manually (optional):

```sh
pre-commit run --all-files
```

---

## Troubleshooting

### “Lint” or “compile” failures
Run from `src/`:

```sh
npm ci
npm run compile
npm run lint
```

### Tests failing unexpectedly
Run the relevant suite explicitly:

```sh
cd src
npm run test:unit
npm run test:api
npm run test:infra
npm run test:e2e
```

### Contract tests won’t start
Ensure required Pact environment variables are set (names listed above) and required ports used by local test tooling are available. See scripts under `src/tests/contract/`.

---

## Licence
This repository does not currently publish a LICENSE/LICENCE file. If you need reuse/distribution terms, consult the owning organisation’s guidance before redistributing.
