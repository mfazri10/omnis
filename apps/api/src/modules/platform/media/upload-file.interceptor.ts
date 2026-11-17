import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Observable } from "rxjs";

/**
 * Batas memori multipart 6 MB: backstop sebelum validasi service
 * (UPLOAD_MAX_BYTES, default 5 MB) agar file raksasa ditolak rapi,
 * bukan OOM. Lihat catatan UPLOAD_MAX_BYTES di .env.example.
 */
export const UPLOAD_MEMORY_LIMIT_BYTES = 6 * 1024 * 1024;

const BaseUploadInterceptor = FileInterceptor("file", {
  limits: { fileSize: UPLOAD_MEMORY_LIMIT_BYTES, files: 1 },
});

function toIndonesian(error: unknown): Error {
  if (error instanceof PayloadTooLargeException) {
    return new PayloadTooLargeException(
      "Ukuran file melebihi batas 6 MB. Kecilkan file lalu coba lagi.",
    );
  }
  if (error instanceof BadRequestException) {
    const message =
      typeof error.message === "string" ? error.message : "";
    if (/unexpected|field/i.test(message)) {
      return new BadRequestException(
        'Berkas wajib diunggah pada field "file".',
      );
    }
    return new BadRequestException(
      "Berkas tidak terbaca. Pastikan form memakai multipart/form-data dengan field \"file\".",
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new BadRequestException("Berkas tidak terbaca.");
}

@Injectable()
export class UploadFileInterceptor extends BaseUploadInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    try {
      return await super.intercept(context, next);
    } catch (error: unknown) {
      throw toIndonesian(error);
    }
  }
}
