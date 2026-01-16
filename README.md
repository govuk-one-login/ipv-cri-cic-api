# ipv-cri-cic-api

Claimed Identity Collector (CIC) CRI service for GOV.UK One Login. This repo contains the CIC API, an IPV stub for end-to-end testing, and a test harness. The CIC API is deployed to AWS using AWS SAM (`deploy/template.yaml`) as **nodejs20.x** Lambda functions (built from TypeScript in `src/`). The OpenAPI contract is in `deploy/cic-spec.yaml` (OpenAPI 3.0.1).

> [!IMPORTANT]
> This repository is **public**. Do **not** commit secrets, credentials, internal URLs, account identifiers, template IDs, or sensitive configuration values. Document **names** and **purposes** only. Use placeholders in examples.

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

Service context: CIC collects a user's claimed **name** and **date of birth** and issues a Verifiable Credential (VC) that downstream services can use (for example, F2F or low-confidence routes). It does **not** verify attributes, assign a GPG45 score, or raise contra indicators.

At a high level it:
- Creates and manages **sessions** for users.
- Accepts and persists the user’s **claimed identity** (captured by a frontend).
- Issues an **authorization code** and **access token** (OAuth2-style flow used by IPV components).
- Provides a **userinfo** endpoint used downstream in the IPV journey.
- Publishes service **JWKS** for token verification and cryptographic operations.
- Provides endpoints used operationally (e.g. aborting a session) and configuration endpoints used by the frontend.

> [!TIP]
> The **spec is the source of truth**. Use `deploy/cic-spec.yaml` for request/response shapes and per-endpoint requirements.

---

## Repository layout
- `deploy/` – SAM template, OpenAPI spec, and deployment config
- `src/` – Lambda handlers and shared code (TypeScript)
- `src/tests/` – unit, API, contract, infra tests
- `cic-ipv-stub/` – IPV stub for driving journeys (test-only)
- `test-harness/` – harness utilities used in tests
- `infra-l2-*` – shared infra templates (e.g. Dynamo/KMS)
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
- **Node.js 22** for local development (see `src/package.json` `engines.node`)
- npm
- (Optional) AWS SAM CLI for building/deploying stacks
- Docker + AWS credentials (only required if you run the containerised tests against a deployed stack)

### Install & run common local checks
```sh
cd src
npm ci
npm run compile
npm run lint
npm run test:unit
```

> [!NOTE]
> Lambdas run on nodejs20.x in AWS, but local development uses Node 22.

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
> Keep broker credentials and URLs out of this public repo. Document names only and use placeholders in examples.

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

> [!CAUTION]
> Review `run-tests-locally.sh` before use. These runners typically:
> - query CloudFormation outputs for a stack,
> - write temporary env files (often including AWS credentials),
> - and run tests inside a Docker container.
>
> Ensure any generated files (e.g. `docker_vars.env`, `cf-output.txt`, `results/`) are not committed.

> [!TIP]
> The authoritative mapping of CloudFormation outputs → test environment variables is in `run-tests.sh`. Document names only in PRs unless your team explicitly approves publishing more detail.

---

## Authentication and required headers
Per `deploy/cic-spec.yaml`, endpoints typically rely on a combination of:
- Session headers (e.g. `session-id`, `x-govuk-signin-session-id` for some endpoints)
- Authorization header for Bearer access token calls:

```
Authorization: Bearer <token>
```

> [!TIP]
> Use `deploy/cic-spec.yaml` to confirm the exact header names and whether they are `required: true` per path.

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

### Dev / personal stack naming
Deploy with a custom stack name (include your initials) to avoid overwriting a shared API stack. Set the stack name in `deploy/samconfig.toml` (for example, `cic-cri-api-<initials>` or similar). After deploying, update the test harness SAM config in `test-harness/deploy/samconfig.toml` to reference the custom API stack name so the harness targets the correct stack.

### Local / ephemeral deployment (exceptional)
```sh
cd deploy
sam build --parallel
sam deploy --resolve-s3 --stack-name "YOUR_STACK_NAME" --confirm-changeset --config-env dev
```

> [!NOTE]
> Parameter overrides and environment-specific deployment values are intentionally not documented here (public repo hygiene). Use your organisation’s internal runbooks for environment-specific instructions.

---

## JWKS
JWKS published at `/.well-known/jwks.json`; see `deploy/cic-spec.yaml`.

---

## Code owners
If `CODEOWNERS` is present, it defines review requirements.

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
Ensure required Pact environment variables are set (names listed above).

Ensure the ports referenced in `tests/contract` scripts are available.

Use the helper scripts:
```sh
cd src
npm run start:dynamodblocal
npm run test:pactconnection
```

## Licence
This repository does not currently publish a `LICENSE`/`LICENCE` file. If you need reuse/distribution terms, consult the owning organisation’s guidance before redistributing.
