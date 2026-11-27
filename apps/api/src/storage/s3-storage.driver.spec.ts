import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ConfigService } from "@nestjs/config";
import { S3StorageDriver } from "./s3-storage.driver";

function makeDriver(): S3StorageDriver {
  const values: Record<string, string> = {
    S3_REGION: "us-east-1",
    S3_BUCKET: "media-bucket",
    S3_ENDPOINT: "https://s3.example.test",
    S3_PUBLIC_BASE_URL: "https://cdn.example.test/media",
    S3_ACCESS_KEY_ID: "access-key",
    S3_SECRET_ACCESS_KEY: "secret-key",
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  return new S3StorageDriver(config);
}

describe("S3StorageDriver", () => {
  it("uploads content with the configured bucket, key, and MIME type", async () => {
    const send = jest.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
    try {
      await makeDriver().put("tenant/file name.png", Buffer.from("image"), "image/png");
      expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
      expect(send.mock.calls[0]?.[0].input).toMatchObject({
        Bucket: "media-bucket",
        Key: "tenant/file name.png",
        ContentType: "image/png",
      });
    } finally {
      send.mockRestore();
    }
  });

  it("deletes from the configured bucket and encodes public URLs", async () => {
    const send = jest.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
    try {
      const driver = makeDriver();
      await driver.delete("tenant/file.png");
      expect(send.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand);
      expect(send.mock.calls[0]?.[0].input).toMatchObject({ Bucket: "media-bucket", Key: "tenant/file.png" });
      expect(driver.publicUrl("tenant/file name.png")).toBe("https://cdn.example.test/media/tenant/file%20name.png");
    } finally {
      send.mockRestore();
    }
  });
});
