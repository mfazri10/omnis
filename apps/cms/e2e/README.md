# CMS browser smoke test

The smoke test logs in as a temporary Super Admin, provisions a CBT app through the CMS, selects it from the app switcher, and visits platform and app pages at desktop and phone widths. It writes one mobile screenshot to `/tmp/cms-production-readiness-mobile.png`.

Use a disposable Postgres control-plane database. The test creates App DBs while provisioning and does not delete them. Never point it at the shared development or production database.

## Run it

1. Start the local Postgres and Redis services. Create a new empty control-plane database, for example `platform_browser_test_20261127`, and set these values in both terminal sessions:

   ```sh
   CONTROL_PLANE_DB_URL=postgresql://postgres:postgres@localhost:5433/platform_browser_test_20261127
   POSTGRES_BASE_URL=postgresql://postgres:postgres@localhost:5433
   REDIS_URL=redis://localhost:6379
   ```

   Adjust the port and credentials for the local database service.

2. Apply the platform migrations from `apps/api`:

   ```sh
   CONTROL_PLANE_DB_URL="$CONTROL_PLANE_DB_URL" \
   POSTGRES_BASE_URL="$POSTGRES_BASE_URL" \
   bun run db:migrate up --scope platform
   ```

3. Create a temporary Super Admin in the isolated database. Use a throwaway password:

   ```sh
   CONTROL_PLANE_DB_URL="$CONTROL_PLANE_DB_URL" \
   POSTGRES_BASE_URL="$POSTGRES_BASE_URL" \
   REDIS_URL="$REDIS_URL" \
   BETTER_AUTH_SECRET=browser-fixture-only-secret-at-least-32-characters \
   BETTER_AUTH_URL=http://localhost:3000 \
   CMS_ORIGIN=http://localhost:3001 \
   CORS_ORIGIN=http://localhost:3001 \
   NODE_ENV=test \
   bun run seed:admin -- --email=browser-test@local.test \
     --password=replace-with-a-throwaway-password \
     --name="Browser Fixture" --super
   ```

4. Start the API from `apps/api` with the same database values and auth settings. Set `API_PORT=3000`, and set `CAMPAIGN_RUNNER=off` and `EXPORT_RUNNER=off` so background work stays idle.

5. Start the CMS from `apps/cms` with `NEXT_PUBLIC_API_URL=http://localhost:3000`:

   ```sh
   NEXT_PUBLIC_API_URL=http://localhost:3000 bunx next dev --port 3001 --webpack
   ```

   Use `localhost` for both the CMS and API origins so the browser accepts the session cookie. If ports 3000 or 3001 are occupied, choose two free ports and update `BETTER_AUTH_URL`, `CMS_ORIGIN`, `CORS_ORIGIN`, `API_PORT`, `NEXT_PUBLIC_API_URL`, and `CMS_TEST_URL` to match.

6. From `apps/cms`, run the smoke test with the temporary admin credentials:

   ```sh
   CMS_TEST_URL=http://localhost:3001 \
   BROWSER_TEST_EMAIL=browser-test@local.test \
   BROWSER_TEST_PASSWORD=replace-with-a-throwaway-password \
   bun run test:e2e
   ```

The test creates a new application slug for each run unless `BROWSER_TEST_APP_SLUG` is set. When finished, drop the disposable control-plane database and every App DB created by the test.
