import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  const base = {
    CONTROL_PLANE_DB_URL: "postgresql://localhost:5432/platform",
    POSTGRES_BASE_URL: "postgresql://localhost:5432",
    REDIS_URL: "redis://localhost:6379",
    BETTER_AUTH_SECRET: "rahasia-dev-minimal-32-karakter-xxxx",
  };

  it("menerima config lengkap beserta nilai default", () => {
    expect(validateEnv({ ...base })).toMatchObject({
      ...base,
      API_PORT: 3000,
      CORS_ORIGIN: "http://localhost:3001",
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://localhost:3000",
      CMS_ORIGIN: "http://localhost:3001",
    });
  });

  it("menolak bila env wajib hilang", () => {
    const { REDIS_URL: _dropped, ...rest } = base;
    expect(_dropped).toBeDefined();
    expect(() => validateEnv(rest)).toThrow("REDIS_URL");
    const { BETTER_AUTH_SECRET: _secret, ...restSecret } = base;
    expect(_secret).toBeDefined();
    expect(() => validateEnv(restSecret)).toThrow("BETTER_AUTH_SECRET");
  });

  it("menolak API_PORT yang tidak valid", () => {
    expect(() => validateEnv({ ...base, API_PORT: "abc" })).toThrow(
      "API_PORT",
    );
  });

  it("FCM_CREDENTIAL_KEY opsional tetapi harus 64 hex bila ada", () => {
    expect(validateEnv({ ...base }).FCM_CREDENTIAL_KEY).toBeUndefined();
    expect(
      validateEnv({ ...base, FCM_CREDENTIAL_KEY: "ab".repeat(32) })
        .FCM_CREDENTIAL_KEY,
    ).toBe("ab".repeat(32));
    expect(() =>
      validateEnv({ ...base, FCM_CREDENTIAL_KEY: "terlalu-pendek" }),
    ).toThrow("FCM_CREDENTIAL_KEY");
  });

  it("PROVISION_TIMEOUT_MS default 30000 dan harus positif", () => {
    expect(validateEnv({ ...base }).PROVISION_TIMEOUT_MS).toBe(30000);
    expect(
      validateEnv({ ...base, PROVISION_TIMEOUT_MS: "60000" })
        .PROVISION_TIMEOUT_MS,
    ).toBe(60000);
    expect(() =>
      validateEnv({ ...base, PROVISION_TIMEOUT_MS: "-5" }),
    ).toThrow("PROVISION_TIMEOUT_MS");
  });

  it("EXPORT_RUNNER default on", () => {
    expect(validateEnv({ ...base }).EXPORT_RUNNER).toBe("on");
    expect(validateEnv({ ...base, EXPORT_RUNNER: "off" }).EXPORT_RUNNER).toBe(
      "off",
    );
  });

  it("EXPORT_RUNNER_INTERVAL_MS default 5000 dan harus positif", () => {
    expect(validateEnv({ ...base }).EXPORT_RUNNER_INTERVAL_MS).toBe(5000);
    expect(() =>
      validateEnv({ ...base, EXPORT_RUNNER_INTERVAL_MS: "0" }),
    ).toThrow("EXPORT_RUNNER_INTERVAL_MS");
    expect(() =>
      validateEnv({ ...base, EXPORT_RUNNER_INTERVAL_MS: "cepat" }),
    ).toThrow("EXPORT_RUNNER_INTERVAL_MS");
  });

  it("EXPORT_MAX_ROWS default 50000 dan harus positif", () => {
    expect(validateEnv({ ...base }).EXPORT_MAX_ROWS).toBe(50000);
    expect(
      validateEnv({ ...base, EXPORT_MAX_ROWS: "1000" }).EXPORT_MAX_ROWS,
    ).toBe(1000);
    expect(() => validateEnv({ ...base, EXPORT_MAX_ROWS: "-5" })).toThrow(
      "EXPORT_MAX_ROWS",
    );
  });

  it("EXPORT_TTL_HOURS default 24 dan harus positif", () => {
    expect(validateEnv({ ...base }).EXPORT_TTL_HOURS).toBe(24);
    expect(() => validateEnv({ ...base, EXPORT_TTL_HOURS: "0" })).toThrow(
      "EXPORT_TTL_HOURS",
    );
  });

  it("menolak konfigurasi production tanpa SMTP, S3, dan FCM", () => {
    expect(() => validateEnv({ ...base, NODE_ENV: "production" })).toThrow("SMTP_HOST");
    const withSmtp = {
      ...base,
      NODE_ENV: "production",
      SMTP_HOST: "smtp.example.test",
      SMTP_FROM: "support@example.test",
    };
    expect(() => validateEnv(withSmtp)).toThrow("STORAGE_DRIVER");
    expect(() => validateEnv({ ...withSmtp, STORAGE_DRIVER: "s3" })).toThrow("S3_REGION");
    expect(() => validateEnv({
      ...withSmtp,
      STORAGE_DRIVER: "s3",
      S3_REGION: "us-east-1",
      S3_BUCKET: "bucket",
      S3_PUBLIC_BASE_URL: "https://cdn.example.test",
    })).toThrow("PUSH_DRIVER");
  });

  it("EXPORT_STORAGE_ROOT default ./storage/exports dan tak boleh kosong", () => {
    expect(validateEnv({ ...base }).EXPORT_STORAGE_ROOT).toBe(
      "./storage/exports",
    );
    expect(
      validateEnv({ ...base, EXPORT_STORAGE_ROOT: "/data/ekspor" })
        .EXPORT_STORAGE_ROOT,
    ).toBe("/data/ekspor");
    expect(() =>
      validateEnv({ ...base, EXPORT_STORAGE_ROOT: "" }),
    ).toThrow("EXPORT_STORAGE_ROOT");
  });
});
