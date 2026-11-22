import { HttpException } from "@nestjs/common";

/**
 * Pesan error yang berguna dari sebuah HttpException.
 *
 * `HttpException.message` hanya berbunyi "Bad Request Exception" atau
 * "Forbidden Exception" ketika exception dibuat dengan objek respons,
 * sedangkan pesan sesungguhnya hidup di `response.message`:
 * - ValidationPipe menaruh daftar pelanggaran (array string) di sana;
 * - guard dan service yang melempar `{ message, ...field }` menaruh
 *   pesan Indonesia di sana.
 * Tanpa helper ini, kesalahan validasi tampil sebagai "Bad Request
 * Exception" dan admin tidak tahu bagian mana yang salah.
 */
export function httpExceptionMessage(exception: HttpException): string {
  const response: unknown = exception.getResponse();
  const raw: unknown =
    typeof response === "object" && response !== null
      ? (response as { message?: unknown }).message
      : response;

  if (typeof raw === "string" && raw.trim() !== "") {
    return raw;
  }
  if (Array.isArray(raw)) {
    const parts = raw.filter(
      (item): item is string => typeof item === "string" && item.trim() !== "",
    );
    if (parts.length > 0) {
      return parts.join("; ");
    }
  }
  return exception.message;
}
