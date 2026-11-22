import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Observable, catchError, throwError } from "rxjs";
import { isUndefinedTable } from "./cbt-dashboard.section";

/**
 * Aplikasi tanpa migrasi app-cbt menghasilkan error Postgres 42P01
 * (undefined_table) yang otherwise jadi INTERNAL_ERROR. Interceptor ini
 * memetakannya ke pesan jelas untuk admin CMS; error lain diteruskan
 * apa adanya ke filter global.
 */
@Injectable()
export class CbtTablesInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) =>
        throwError(() =>
          isUndefinedTable(error)
            ? new BadRequestException(
                "Modul CBT belum terpasang di aplikasi ini. Terapkan migrasi app-cbt ke App DB aplikasi.",
              )
            : error,
        ),
      ),
    );
  }
}
