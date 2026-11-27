import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { Injectable } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PushPayload, PushSendResult, PushSender } from "./push-sender";

@Injectable()
export class FcmPushSender implements PushSender, OnModuleDestroy {
  readonly simulated = false;
  private readonly apps = new Map<string, ReturnType<typeof initializeApp>>();

  async send(
    appId: number,
    credentialJson: string | null,
    token: string,
    payload: PushPayload,
  ): Promise<PushSendResult> {
    if (!credentialJson) {
      throw new Error(`Kredensial FCM aplikasi ${appId} belum dikonfigurasi.`);
    }
    const hash = createHash("sha256").update(credentialJson).digest("hex");
    const firebaseApp = await this.getApp(appId, hash, credentialJson);
    try {
      await getMessaging(firebaseApp).send({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: payload.linkTarget ? { linkTarget: payload.linkTarget } : undefined,
      });
      return "sent";
    } catch (error: unknown) {
      return classifyFcmFailure(error);
    }
  }

  async close(): Promise<void> {
    const current = [...this.apps.values()];
    this.apps.clear();
    await Promise.all(current.map((app) => deleteApp(app)));
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private async getApp(
    appId: number,
    hash: string,
    credentialJson: string,
  ): Promise<ReturnType<typeof initializeApp>> {
    const name = `fcm-${appId}-${hash}`;
    for (const [key, cached] of this.apps) {
      if (key.startsWith(`fcm-${appId}-`) && key !== name) {
        this.apps.delete(key);
        await deleteApp(cached);
      }
    }
    const cached = this.apps.get(name);
    if (cached) return cached;
    const credentials = JSON.parse(credentialJson) as Record<string, string>;
    const app = getApps().find((candidate) => candidate.name === name) ?? initializeApp({ credential: cert(credentials) }, name);
    this.apps.set(name, app);
    return app;
  }
}

export function classifyFcmFailure(error: unknown): "invalid-token" | "failed" | "unknown" {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
    return "invalid-token";
  }
  // Explicit validation/authentication responses mean FCM rejected the message.
  if (code.startsWith("messaging/invalid-") || code === "messaging/mismatched-credential" || code === "messaging/third-party-auth-error") {
    return "failed";
  }
  // Timeout, connection loss, or an unclassified server failure may happen after acceptance.
  return "unknown";
}
