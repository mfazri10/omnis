// better-auth hanya didistribusikan sebagai ESM; Jest (CommonJS) tidak bisa
// memuatnya. Mock modulnya secara global — suite yang butuh perilaku auth
// nyata memakai smoke test / integration test (doc 15), bukan unit test.
jest.mock("better-auth", () => ({ betterAuth: jest.fn() }));
jest.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: jest.fn(),
}));

export {};
