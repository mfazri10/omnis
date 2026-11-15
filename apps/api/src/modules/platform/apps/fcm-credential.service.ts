import { InternalServerErrorException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

@Injectable()
export class FcmCredentialService {
  constructor(private readonly config: ConfigService) {}

  /** Enkripsi AES-256-GCM → format `iv:tag:data` heksadesimal. */
  encrypt(plaintext: string): string {
    const key = this.keyBytes();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${data.toString("hex")}`;
  }

  /** Dekripsi format `encrypt`; rusak → InternalServerError (data korup). */
  decrypt(ciphertext: string): string {
    const key = this.keyBytes();
    const [ivHex, tagHex, dataHex] = ciphertext.split(":");
    if (!ivHex || !tagHex || !dataHex) {
      throw new InternalServerErrorException("Kredensial FCM rusak.");
    }
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(ivHex, "hex"),
      );
      decipher.setAuthTag(Buffer.from(tagHex, "hex"));
      return decipher.update(dataHex, "hex", "utf8") + decipher.final("utf8");
    } catch {
      throw new InternalServerErrorException("Kredensial FCM rusak.");
    }
  }

  private keyBytes(): Buffer {
    const raw = this.config.get<string>("FCM_CREDENTIAL_KEY");
    if (!raw || !KEY_PATTERN.test(raw)) {
      throw new InternalServerErrorException(
        "Layanan kredensial FCM belum dikonfigurasi dengan benar.",
      );
    }
    return Buffer.from(raw, "hex");
  }
}
