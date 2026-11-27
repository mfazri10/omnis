import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { StorageDriver } from "./storage.driver";

@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const region = config.get<string>("S3_REGION");
    this.bucket = config.get<string>("S3_BUCKET") ?? "";
    const endpoint = config.get<string>("S3_ENDPOINT");
    const accessKeyId = config.get<string>("S3_ACCESS_KEY_ID");
    const secretAccessKey = config.get<string>("S3_SECRET_ACCESS_KEY");
    this.publicBaseUrl = (config.get<string>("S3_PUBLIC_BASE_URL") ?? "").replace(/\/+$/, "");
    if (!region || !this.bucket || !this.publicBaseUrl) {
      throw new Error("S3_REGION, S3_BUCKET, dan S3_PUBLIC_BASE_URL wajib dikonfigurasi.");
    }
    if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
      throw new Error("S3_ACCESS_KEY_ID dan S3_SECRET_ACCESS_KEY harus diatur bersama.");
    }
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  async put(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}
