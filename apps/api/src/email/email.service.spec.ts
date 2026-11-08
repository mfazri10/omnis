import type { ConfigService } from "@nestjs/config";
import { EmailService } from "./email.service";

function makeService(
  values: Record<string, string | number | undefined>,
): EmailService {
  const config = {
    get: (key: string, defaultValue?: unknown) =>
      values[key] ?? defaultValue,
  } as unknown as ConfigService;
  return new EmailService(config);
}

describe("EmailService", () => {
  it("stub konsol saat SMTP tidak dikonfigurasi", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const service = makeService({});
      await service.send("a@contoh.id", "Subjek", "<p>html</p>", "teks");
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("[email-stub]"),
      );
    } finally {
      log.mockRestore();
    }
  });

  it("membuat transporter saat SMTP dikonfigurasi", () => {
    expect(() =>
      makeService({ SMTP_HOST: "smtp.contoh.id" }),
    ).not.toThrow();
  });
});
