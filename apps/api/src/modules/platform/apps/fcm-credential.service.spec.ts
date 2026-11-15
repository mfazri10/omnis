import { InternalServerErrorException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { FcmCredentialService } from "./fcm-credential.service";

const VALID_KEY = "ab".repeat(32);

function makeService(key: string | undefined): FcmCredentialService {
  const config = {
    get: jest.fn().mockImplementation((name: string): string | undefined => {
      if (name === "FCM_CREDENTIAL_KEY") {
        return key;
      }
      return undefined;
    }),
  } as unknown as ConfigService;
  return new FcmCredentialService(config);
}

describe("FcmCredentialService", () => {
  it("encrypt lalu decrypt roundtrip", () => {
    const service = makeService(VALID_KEY);
    const cipher = service.encrypt('{"project_id":"x"}');
    expect(cipher).not.toContain("project_id");
    expect(service.decrypt(cipher)).toBe('{"project_id":"x"}');
  });

  it("kunci hilang → InternalServerError jelas", () => {
    const service = makeService(undefined);
    expect(() => service.encrypt("x")).toThrow(InternalServerErrorException);
    expect(() => service.encrypt("x")).toThrow("belum dikonfigurasi");
  });

  it("kunci format salah → InternalServerError", () => {
    const service = makeService("terlalu-pendek");
    expect(() => service.encrypt("x")).toThrow(InternalServerErrorException);
  });

  it("cipher rusak → InternalServerError", () => {
    const service = makeService(VALID_KEY);
    expect(() => service.decrypt("bukan-cipher")).toThrow(
      InternalServerErrorException,
    );
    const tampered = `${"00".repeat(12)}:${"00".repeat(16)}:${"00".repeat(8)}`;
    expect(() => service.decrypt(tampered)).toThrow(
      InternalServerErrorException,
    );
  });
});
