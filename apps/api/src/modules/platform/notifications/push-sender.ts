import { Injectable } from "@nestjs/common";

/**
 * Abstraksi pengiriman push (doc 08: FCM, kredensial per aplikasi).
 * Interface sengaja kecil — driver FCM nyata menyusul tanpa mengubah
 * pemakainya (pola StorageDriver F09).
 */
export const PUSH_SENDER = Symbol("PUSH_SENDER");

export interface PushPayload {
  title: string;
  body: string;
  imageUrl: string | null;
  linkTarget: string | null;
}

export type PushSendResult = "sent" | "invalid-token" | "failed";

export interface PushSender {
  /**
   * Kirim ke satu token. `invalid-token` = token basi, wajib dihapus
   * pemanggil dan dihitung gagal.
   */
  send(token: string, payload: PushPayload): Promise<PushSendResult>;
}

/**
 * Driver Fase 1 (default, dev): tanpa jaringan, tanpa firebase-admin.
 * Selalu mengembalikan `sent` agar alur agregat teruji jujur; JANGAN
 * dipakai sebagai bukti pengiriman FCM nyata.
 */
@Injectable()
export class NoopPushSender implements PushSender {
  send(token: string, payload: PushPayload): Promise<PushSendResult> {
    const tail = token.length > 6 ? `***${token.slice(-6)}` : "***";
    console.log(
      `[push:noop] "${payload.title}" → ${tail} (draf dev, tanpa jaringan).`,
    );
    return Promise.resolve("sent");
  }
}
