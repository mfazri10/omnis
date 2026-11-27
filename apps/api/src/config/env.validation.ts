export interface EnvVars {
  CONTROL_PLANE_DB_URL: string;
  POSTGRES_BASE_URL: string;
  REDIS_URL: string;
  API_PORT: number;
  CORS_ORIGIN: string;
  NODE_ENV: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CMS_ORIGIN: string;
  FCM_CREDENTIAL_KEY?: string;
  PROVISION_TIMEOUT_MS: number;
  STORAGE_LOCAL_ROOT: string;
  STORAGE_PUBLIC_BASE_URL: string;
  STORAGE_DRIVER: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_PUBLIC_BASE_URL?: string;
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM: string;
  UPLOAD_MAX_BYTES: number;
  UPLOAD_ALLOWED_MIME: string;
  PUSH_DRIVER: string;
  CAMPAIGN_RUNNER: string;
  CAMPAIGN_RUNNER_INTERVAL_MS: number;
  EXPORT_RUNNER: string;
  EXPORT_RUNNER_INTERVAL_MS: number;
  EXPORT_MAX_ROWS: number;
  EXPORT_TTL_HOURS: number;
  EXPORT_STORAGE_ROOT: string;
}

const REQUIRED_KEYS = [
  "CONTROL_PLANE_DB_URL",
  "POSTGRES_BASE_URL",
  "REDIS_URL",
  "BETTER_AUTH_SECRET",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  for (const key of REQUIRED_KEYS) {
    if (!isNonEmptyString(config[key])) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
  const apiPort = Number(config.API_PORT ?? 3000);
  if (!Number.isInteger(apiPort) || apiPort <= 0) {
    throw new Error("API_PORT must be a positive integer");
  }
  const fcmKey = config.FCM_CREDENTIAL_KEY;
  if (
    fcmKey !== undefined &&
    (typeof fcmKey !== "string" || !/^[0-9a-fA-F]{64}$/.test(fcmKey))
  ) {
    throw new Error("FCM_CREDENTIAL_KEY must be 64 hex characters");
  }
  const provisionTimeout = Number(config.PROVISION_TIMEOUT_MS ?? 30000);
  if (!Number.isInteger(provisionTimeout) || provisionTimeout <= 0) {
    throw new Error("PROVISION_TIMEOUT_MS must be a positive integer");
  }
  const uploadMaxBytes = Number(config.UPLOAD_MAX_BYTES ?? 5242880);
  if (!Number.isInteger(uploadMaxBytes) || uploadMaxBytes <= 0) {
    throw new Error("UPLOAD_MAX_BYTES must be a positive integer");
  }
  const runnerInterval = Number(config.CAMPAIGN_RUNNER_INTERVAL_MS ?? 30000);
  if (!Number.isInteger(runnerInterval) || runnerInterval <= 0) {
    throw new Error("CAMPAIGN_RUNNER_INTERVAL_MS must be a positive integer");
  }
  const exportRunnerInterval = Number(config.EXPORT_RUNNER_INTERVAL_MS ?? 5000);
  if (!Number.isInteger(exportRunnerInterval) || exportRunnerInterval <= 0) {
    throw new Error("EXPORT_RUNNER_INTERVAL_MS must be a positive integer");
  }
  const exportMaxRows = Number(config.EXPORT_MAX_ROWS ?? 50000);
  if (!Number.isInteger(exportMaxRows) || exportMaxRows <= 0) {
    throw new Error("EXPORT_MAX_ROWS must be a positive integer");
  }
  const exportTtlHours = Number(config.EXPORT_TTL_HOURS ?? 24);
  if (!Number.isInteger(exportTtlHours) || exportTtlHours <= 0) {
    throw new Error("EXPORT_TTL_HOURS must be a positive integer");
  }
  if (
    config.EXPORT_STORAGE_ROOT !== undefined &&
    !isNonEmptyString(config.EXPORT_STORAGE_ROOT)
  ) {
    throw new Error("EXPORT_STORAGE_ROOT must be a non-empty string");
  }
  const nodeEnv = isNonEmptyString(config.NODE_ENV) ? config.NODE_ENV : "development";
  const storageDriver = isNonEmptyString(config.STORAGE_DRIVER)
    ? config.STORAGE_DRIVER
    : "local";
  const smtpPort = Number(config.SMTP_PORT ?? 587);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error("SMTP_PORT must be an integer from 1 to 65535");
  }
  if (storageDriver !== "local" && storageDriver !== "s3") {
    throw new Error('STORAGE_DRIVER must be "local" or "s3"');
  }
  if (nodeEnv === "production") {
    if (!isNonEmptyString(config.SMTP_HOST)) {
      throw new Error("SMTP_HOST is required in production");
    }
    if (!isNonEmptyString(config.SMTP_FROM)) {
      throw new Error("SMTP_FROM is required in production");
    }
    if (storageDriver !== "s3") {
      throw new Error('STORAGE_DRIVER must be "s3" in production');
    }
  }
  if (storageDriver === "s3") {
    for (const key of ["S3_REGION", "S3_BUCKET", "S3_PUBLIC_BASE_URL"] as const) {
      if (!isNonEmptyString(config[key])) throw new Error(`${key} is required when STORAGE_DRIVER=s3`);
    }
    if (Boolean(config.S3_ACCESS_KEY_ID) !== Boolean(config.S3_SECRET_ACCESS_KEY)) {
      throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set together");
    }
  }
  if (nodeEnv === "production") {
    if ((config.PUSH_DRIVER ?? "noop") !== "fcm") {
      throw new Error('PUSH_DRIVER must be "fcm" in production');
    }
    if (!isNonEmptyString(config.FCM_CREDENTIAL_KEY)) {
      throw new Error("FCM_CREDENTIAL_KEY is required in production");
    }
  }
  return {
    CONTROL_PLANE_DB_URL: config.CONTROL_PLANE_DB_URL as string,
    POSTGRES_BASE_URL: config.POSTGRES_BASE_URL as string,
    REDIS_URL: config.REDIS_URL as string,
    API_PORT: apiPort,
    CORS_ORIGIN: isNonEmptyString(config.CORS_ORIGIN)
      ? config.CORS_ORIGIN
      : "http://localhost:3001",
    NODE_ENV: nodeEnv,
    BETTER_AUTH_SECRET: config.BETTER_AUTH_SECRET as string,
    BETTER_AUTH_URL: isNonEmptyString(config.BETTER_AUTH_URL)
      ? config.BETTER_AUTH_URL
      : `http://localhost:${apiPort}`,
    CMS_ORIGIN: isNonEmptyString(config.CMS_ORIGIN)
      ? config.CMS_ORIGIN
      : "http://localhost:3001",
    FCM_CREDENTIAL_KEY:
      typeof config.FCM_CREDENTIAL_KEY === "string"
        ? config.FCM_CREDENTIAL_KEY
        : undefined,
    PROVISION_TIMEOUT_MS: provisionTimeout,
    STORAGE_LOCAL_ROOT: isNonEmptyString(config.STORAGE_LOCAL_ROOT)
      ? config.STORAGE_LOCAL_ROOT
      : "./storage/media",
    STORAGE_PUBLIC_BASE_URL: isNonEmptyString(
      config.STORAGE_PUBLIC_BASE_URL,
    )
      ? config.STORAGE_PUBLIC_BASE_URL
      : "http://localhost:3000/media",
    STORAGE_DRIVER: storageDriver,
    S3_ENDPOINT: isNonEmptyString(config.S3_ENDPOINT) ? config.S3_ENDPOINT : undefined,
    S3_REGION: isNonEmptyString(config.S3_REGION) ? config.S3_REGION : undefined,
    S3_BUCKET: isNonEmptyString(config.S3_BUCKET) ? config.S3_BUCKET : undefined,
    S3_ACCESS_KEY_ID: isNonEmptyString(config.S3_ACCESS_KEY_ID) ? config.S3_ACCESS_KEY_ID : undefined,
    S3_SECRET_ACCESS_KEY: isNonEmptyString(config.S3_SECRET_ACCESS_KEY) ? config.S3_SECRET_ACCESS_KEY : undefined,
    S3_PUBLIC_BASE_URL: isNonEmptyString(config.S3_PUBLIC_BASE_URL) ? config.S3_PUBLIC_BASE_URL : undefined,
    SMTP_HOST: isNonEmptyString(config.SMTP_HOST) ? config.SMTP_HOST : undefined,
    SMTP_PORT: smtpPort,
    SMTP_SECURE: config.SMTP_SECURE === true || config.SMTP_SECURE === "true",
    SMTP_USER: isNonEmptyString(config.SMTP_USER) ? config.SMTP_USER : undefined,
    SMTP_PASS: isNonEmptyString(config.SMTP_PASS) ? config.SMTP_PASS : undefined,
    SMTP_FROM: isNonEmptyString(config.SMTP_FROM) ? config.SMTP_FROM : "noreply@localhost",
    UPLOAD_MAX_BYTES: uploadMaxBytes,
    UPLOAD_ALLOWED_MIME: isNonEmptyString(config.UPLOAD_ALLOWED_MIME)
      ? config.UPLOAD_ALLOWED_MIME
      : "image/jpeg,image/png,image/webp,application/pdf",
    PUSH_DRIVER: isNonEmptyString(config.PUSH_DRIVER)
      ? config.PUSH_DRIVER
      : "noop",
    CAMPAIGN_RUNNER: isNonEmptyString(config.CAMPAIGN_RUNNER)
      ? config.CAMPAIGN_RUNNER
      : "on",
    CAMPAIGN_RUNNER_INTERVAL_MS: runnerInterval,
    EXPORT_RUNNER: isNonEmptyString(config.EXPORT_RUNNER)
      ? config.EXPORT_RUNNER
      : "on",
    EXPORT_RUNNER_INTERVAL_MS: exportRunnerInterval,
    EXPORT_MAX_ROWS: exportMaxRows,
    EXPORT_TTL_HOURS: exportTtlHours,
    EXPORT_STORAGE_ROOT: isNonEmptyString(config.EXPORT_STORAGE_ROOT)
      ? config.EXPORT_STORAGE_ROOT
      : "./storage/exports",
  };
}
