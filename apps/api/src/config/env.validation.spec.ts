import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  const base = {
    CONTROL_PLANE_DB_URL: "postgresql://localhost:5432/platform",
    POSTGRES_BASE_URL: "postgresql://localhost:5432",
    REDIS_URL: "redis://localhost:6379",
  };

  it("menerima config lengkap beserta nilai default", () => {
    expect(validateEnv({ ...base })).toMatchObject({
      ...base,
      API_PORT: 3000,
      CORS_ORIGIN: "http://localhost:3001",
      NODE_ENV: "development",
    });
  });

  it("menolak bila env wajib hilang", () => {
    const { REDIS_URL: _dropped, ...rest } = base;
    expect(_dropped).toBeDefined();
    expect(() => validateEnv(rest)).toThrow("REDIS_URL");
  });

  it("menolak API_PORT yang tidak valid", () => {
    expect(() => validateEnv({ ...base, API_PORT: "abc" })).toThrow(
      "API_PORT",
    );
  });
});
