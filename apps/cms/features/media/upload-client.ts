/**
 * Klien unggah REST POST /uploads (bukan GraphQL, doc 07 §5).
 * Batas di sini cermin default server (UPLOAD_MAX_BYTES /
 * UPLOAD_ALLOWED_MIME); penegakan final tetap di server.
 */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const UPLOAD_ALLOWED_MIME: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const MIME_LABELS: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "application/pdf": "PDF",
};

export interface UploadResult {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    const text = mb >= 10 ? String(Math.round(mb)) : String(+mb.toFixed(1));
    return `${text} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export function allowedTypeLabels(): string {
  return UPLOAD_ALLOWED_MIME.map((mime) => MIME_LABELS[mime] ?? mime).join(
    ", ",
  );
}

/** Validasi sisi klien; kembalikan pesan galat atau null bila lolos. */
export function validateClientFile(file: File): string | null {
  if (!UPLOAD_ALLOWED_MIME.includes(file.type)) {
    return `Tipe file "${file.type || "tak dikenal"}" tidak didukung. Tipe yang diizinkan: ${allowedTypeLabels()}.`;
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return `Ukuran file ${formatBytes(file.size)} melebihi batas ${formatBytes(UPLOAD_MAX_BYTES)}.`;
  }
  return null;
}

export interface UploadMediaArgs {
  apiUrl: string;
  appSlug: string;
  file: File;
  altText: string | null;
  onProgress: (percent: number) => void;
  signal?: AbortSignal;
}

/** Unggah via XMLHttpRequest agar progres 0–100% terpantau. */
export function uploadMediaFile(args: UploadMediaArgs): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${args.apiUrl}/uploads`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-App-Slug", args.appSlug);
    xhr.upload.onprogress = (event: ProgressEvent): void => {
      if (event.lengthComputable && event.total > 0) {
        args.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = (): void => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText) as unknown;
      } catch {
        reject(new Error("Respons server tidak valid."));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as UploadResult);
        return;
      }
      const message =
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : `Unggah gagal (kode ${xhr.status}).`;
      reject(new Error(message));
    };
    xhr.onerror = (): void => {
      reject(new Error("Jaringan bermasalah, coba lagi."));
    };
    xhr.onabort = (): void => {
      reject(new Error("Unggahan dibatalkan."));
    };
    if (args.signal) {
      const signal = args.signal;
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    const form = new FormData();
    form.append("file", args.file);
    if (args.altText !== null && args.altText !== "") {
      form.append("altText", args.altText);
    }
    args.onProgress(0);
    xhr.send(form);
  });
}
