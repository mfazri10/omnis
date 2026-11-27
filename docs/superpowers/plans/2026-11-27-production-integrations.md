# Production Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make email, media storage, push delivery, and scheduled processing safe for production while preserving local development fallbacks, then verify the affected CMS flows in a browser.

**Architecture:** Keep the existing `EmailSender`, `StorageDriver`, `PushSender`, and domain services as boundaries. Add provider adapters and production environment validation, move periodic campaign/export processing to a dedicated BullMQ worker with database-backed claims and recovery, and exercise CMS flows against an isolated development database.

**Tech Stack:** NestJS, TypeScript, Drizzle/PostgreSQL, Redis, Nodemailer, Firebase Admin SDK, BullMQ, AWS SDK for JavaScript S3 client, Next.js, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-production-integrations-design.md`

## Global Constraints

- API and CMS remain a Bun/Turborepo monorepo with strict TypeScript.
- Keep application data isolated by App DB; never use a raw header to select a database.
- Keep secrets out of source, logs, screenshots, and committed files.
- Development may use email stub, `NoopPushSender`, and local media storage.
- Production must reject missing SMTP and S3 configuration and must not report noop push as real delivery.
- FCM credentials remain encrypted in the control-plane and are decrypted only server-side.
- Use database state as the source of truth; queue jobs must be idempotent and retry-safe.
- Do not send real email, push notifications, or objects to user accounts during verification.

## Review Focus

- Campaign recovery must never resend an ambiguous or already delivered FCM attempt; stale unresolved targets move to `unknown`, and recovery makes no sender call. Pin tests for persisted per-token outcomes and recovery without a sender call.
- Campaign reschedule/cancel races must not execute stale scheduled work; pin with a worker test that re-reads and conditionally claims the campaign.
- Production boot with incomplete SMTP/S3/FCM configuration must fail with actionable messages; pin with environment validation tests.
- A noop run must end as `simulated`; pin with a service test and CMS status labels.
- Credential rotation must not keep using a cached Firebase app created from old credentials; pin with a test that rotates a campaign app credential.
- Local media GET must remain unavailable when S3 is selected; pin with a controller/module test.

---

### Task 1: Verify the existing CMS in an isolated browser environment

**Files:**
- Create: `apps/cms/e2e/production-readiness.test.ts`
- Modify: `apps/cms/package.json`
- Modify: `apps/cms/app/(shell)/platform/apps/new/page.tsx`
- Create: `apps/cms/e2e/README.md`
- Test: `apps/cms/e2e/production-readiness.test.ts`

**Interfaces:**
- Consume the existing CMS routes, GraphQL API, admin seed command, and test DB setup from `docs/15-testing-strategy.md`.
- Produce a repeatable Bun/Playwright browser smoke suite that provisions a CBT app through the CMS; document isolated API/database startup and teardown. Do not point it at the shared `platform` database.

- [x] **Step 1: Add a failing browser smoke test** that logs in, creates a CBT app, immediately selects it from the app switcher, then visits the platform dashboard, role list, app dashboard, media, notifications, and CBT question pages at desktop and mobile widths. Capture page errors, failed requests, and GraphQL errors.
- [x] **Step 2: Run the test** against an isolated local DB and confirm it fails because the app switcher does not refresh after provisioning.
- [x] **Step 3: Update the provisioning screen** to refetch `MY_APPS_QUERY` and wait for the result before navigating, so the shell store sees the new app.
- [x] **Step 4: Add the `test:e2e` script and fixture instructions.** The test provisions app data through the UI; docs describe a disposable control-plane database and admin, and explicitly forbid using the shared development database.
- [x] **Step 5: Run the browser smoke test** at desktop and mobile viewports. Expected: app switcher option appears immediately, every named route renders, mobile layout has no horizontal overflow, and no page errors, failed GraphQL requests, or GraphQL errors occur.
- [x] **Step 6: Record runtime findings** in the plan ledger. Fix only functional blockers within the approved scope.

### Task 2: Enforce production mail configuration and add S3-compatible storage

**Files:**
- Modify: `apps/api/src/config/env.validation.ts`
- Modify: `apps/api/src/config/env.validation.spec.ts`
- Modify: `apps/api/src/email/email.service.ts`
- Modify: `apps/api/src/email/email.service.spec.ts`
- Create: `apps/api/src/storage/s3-storage.driver.ts`
- Create: `apps/api/src/storage/s3-storage.driver.spec.ts`
- Modify: `apps/api/src/storage/storage.module.ts`
- Modify: `apps/api/src/modules/platform/media/media-upload.controller.ts`
- Modify: `apps/api/src/modules/platform/media/media-upload.controller.spec.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`
- Modify: `docs/16-operasional-teknis.md`

**Interfaces:**
- Consume `StorageDriver.put/delete/publicUrl` and the existing `EmailService` API.
- Produce an S3 driver configured via environment, and a local media route that is registered only when local storage is selected.

- [x] **Step 1: Write failing tests** proving production rejects missing SMTP and S3 configuration; development keeps the email stub/local driver; S3 `put` and `delete` use the configured bucket/key/content type; local GET does not serve files when S3 is selected.
- [x] **Step 2: Run the targeted API tests** and confirm each fails for the missing behavior.
- [x] **Step 3: Add the AWS S3 client dependency and implement** the driver and environment-based provider selection. Keep the local filesystem driver as the default outside production.
- [x] **Step 4: Implement production mail validation** while preserving the existing Nodemailer transport for configured environments.
- [x] **Step 5: Run targeted API tests** and confirm the new paths pass.
- [x] **Step 6: Update deployment documentation** with required SMTP/S3 settings, bucket policy expectations, and local driver behavior.

### Task 3: Add Firebase push delivery and truthful noop outcomes

**Files:**
- Modify: `apps/api/src/modules/platform/notifications/push-sender.ts`
- Create: `apps/api/src/modules/platform/notifications/fcm-push-sender.ts`
- Create: `apps/api/src/modules/platform/notifications/fcm-push-sender.spec.ts`
- Modify: `apps/api/src/modules/platform/notifications/notifications.module.ts`
- Modify: `apps/api/src/modules/platform/notifications/notifications.service.ts`
- Modify: `apps/api/src/modules/platform/notifications/notifications.service.spec.ts`
- Create: `apps/api/migrations/platform/20261127100000_platform_notification_unknown_count.ts`
- Modify: `apps/api/src/modules/platform/entities/notification-campaigns.entity.ts`
- Modify: `apps/api/src/modules/platform/notifications/notifications.repository.ts`
- Modify: `apps/api/src/modules/platform/notifications/notifications.resolver.ts`
- Modify: `apps/cms/app/(shell)/[appSlug]/notifications/page.tsx`
- Modify: `apps/api/src/modules/platform/apps/fcm-credential.service.ts`
- Modify: `apps/api/src/modules/platform/apps/apps.repository.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`
- Modify: `features/F10-notifikasi-push.md`

**Interfaces:**
- Consume encrypted credentials from the existing app registry and `FcmCredentialService.decrypt`.
- Produce a sender that receives the campaign owner's credential context and returns one result per token, including invalid-token, explicit rejection, and ambiguous outcome cases. Persist campaign heartbeat and aggregate outcomes in the control-plane; stale in-flight campaigns become `unknown` without resend.

- [x] **Step 1: Write failing tests** for successful FCM send, invalid registration cleanup, explicit provider rejection, ambiguous provider result, missing app credentials, credential rotation, and noop campaigns ending as `simulated`.
- [x] **Step 2: Run targeted notification tests** and verify they fail for the expected missing behavior.
- [x] **Step 3: Add Firebase Admin SDK and implement** credential-scoped app caching, cache invalidation on credential changes, and token-level result mapping.
- [x] **Step 4: Persist campaign heartbeat and per-token aggregate counts** in the control-plane after every provider response. On restart, unresolved recipients become `unknown`; ambiguous FCM results are never invoked again.
- [x] **Step 5: Update campaign accounting** so noop campaigns end as `simulated`; noop must not increment `sent_count`. Persist and display `simulated_count`; no-token campaigns remain a successful zero-target completion.
- [x] **Step 6: Run targeted notification tests** and confirm the expected state transitions and token cleanup.
- [x] **Step 7: Add the campaign statuses `simulated` and `unknown` to the API schema and CMS status labels; document the service-account configuration flow and FCM readiness accurately in F10.**

### Task 4: Move campaign and export execution to BullMQ workers

**Files:**
- Create: `apps/api/src/worker.ts`
- Modify: `apps/api/src/modules/platform/notifications/campaign-runner.service.ts`
- Modify: `apps/api/src/modules/platform/notifications/campaign-runner.service.spec.ts`
- Modify: `apps/api/src/modules/platform/notifications/notifications.module.ts`
- Modify: `apps/api/src/modules/platform/exports/export-runner.service.ts`
- Modify: `apps/api/src/modules/platform/exports/export-runner.service.spec.ts`
- Modify: `apps/api/src/modules/platform/exports/exports.module.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`
- Modify: `docs/05-arsitektur-sistem.md`
- Modify: `docs/16-operasional-teknis.md`

**Interfaces:**
- Consume existing database claim/execute methods for campaigns and exports.
- Produce a dedicated worker command using Redis/BullMQ; API mutations enqueue or are discovered by a periodic reconciliation job. The database remains authoritative.

- [x] **Step 1: Write failing tests** for stale-send recovery without resend, campaign execution outcomes, claim guards, and cleanup of every worker resource when one close operation fails.
- [x] **Step 2: Run the targeted worker tests** and confirm recovery and shutdown cleanup behavior.
- [x] **Step 3: Add BullMQ dependencies and worker bootstrap** with separate API and worker processes, bounded concurrency, persistent repeat schedules, graceful close, and disabled in-process API timers in production.
- [x] **Step 4: Move periodic campaign/export polling to BullMQ workers** while retaining the DB conditional-claim as the final duplicate guard.
- [x] **Step 5: Add recovery for jobs left in a running state** using a persisted heartbeat and aggregate attempt counts. Mark ambiguous campaign deliveries `unknown` and do not retry them automatically; completed/failed campaign states remain terminal.
- [x] **Step 6: Run targeted worker tests** and confirm claim guard, race, and recovery scenarios pass.
- [x] **Step 7: Update local Compose and ops documentation** to run the worker process separately and describe restart/recovery behavior.

### Task 5: End-to-end validation and status reconciliation

**Files:**
- Modify: `apps/cms/e2e/production-readiness.test.ts`
- Modify: `docs/superpowers/specs/2026-11-27-production-integrations-design.md`
- Modify: `features/F09-media-library.md`
- Modify: `features/F10-notifikasi-push.md`
- Modify: `features/F11-ekspor-csv.md`
- Modify: `docs/09-roadmap.md`

- [x] **Step 1: Add browser coverage** for app provisioning/switching, platform and app routes, CBT navigation, desktop/mobile layout, console errors, failed requests, and GraphQL errors using fixture data only.
- [x] **Step 2: Run targeted browser verification** in desktop and mobile viewports, then inspect console, network, and screenshots.
- [x] **Step 3: Run API/CMS typecheck, lint, test, and build** using the repository scripts; read all output and fix any regressions.
- [x] **Step 4: Reconcile feature statuses** so documentation distinguishes implemented provider integrations from credentials/infrastructure that remain operator-supplied.
- [x] **Step 5: Record exact verification and any blocked live-provider checks** without claiming real email, push, or S3 delivery unless credentials were supplied and the send was explicitly exercised.
