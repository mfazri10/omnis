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
  return {
    CONTROL_PLANE_DB_URL: config.CONTROL_PLANE_DB_URL as string,
    POSTGRES_BASE_URL: config.POSTGRES_BASE_URL as string,
    REDIS_URL: config.REDIS_URL as string,
    API_PORT: apiPort,
    CORS_ORIGIN: isNonEmptyString(config.CORS_ORIGIN)
      ? config.CORS_ORIGIN
      : "http://localhost:3001",
    NODE_ENV: isNonEmptyString(config.NODE_ENV)
      ? config.NODE_ENV
      : "development",
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
  };
}
