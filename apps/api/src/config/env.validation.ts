export interface EnvVars {
  CONTROL_PLANE_DB_URL: string;
  POSTGRES_BASE_URL: string;
  REDIS_URL: string;
  API_PORT: number;
  CORS_ORIGIN: string;
  NODE_ENV: string;
}

const REQUIRED_KEYS = [
  "CONTROL_PLANE_DB_URL",
  "POSTGRES_BASE_URL",
  "REDIS_URL",
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
  };
}
