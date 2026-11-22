import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { GqlExceptionFilter } from "@nestjs/graphql";
import { GraphQLError } from "graphql";
import type { Response } from "express";
import {
  AppNotFoundException,
  AppSuspendedException,
} from "../exceptions/app.exceptions";
import { httpExceptionMessage } from "./http-exception-message";

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.UNAUTHORIZED]: "UNAUTHENTICATED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.BAD_REQUEST]: "BAD_USER_INPUT",
  [HttpStatus.CONFLICT]: "CONFLICT",
};

/**
 * Memetakan exception ke extensions.code stabil (doc 07 §1).
 *
 * Filter ini didaftarkan global (APP_FILTER), jadi ia juga menerima request
 * HTTP biasa. Untuk konteks non-GraphQL kita WAJIB menjawab dengan respons
 * HTTP: mengembalikan GraphQLError di sana membuat Express tidak pernah
 * mengirim apa pun sehingga request menggantung (terbukti pada rute 404).
 */
@Catch()
export class GraphqlExceptionFilter implements GqlExceptionFilter {
  catch(exception: unknown, host?: ArgumentsHost): GraphQLError | void {
    if (host !== undefined && host.getType<string>() !== "graphql") {
      return this.handleHttp(exception, host);
    }

    if (exception instanceof AppNotFoundException) {
      return this.toError(exception.message, "APP_NOT_FOUND");
    }
    if (exception instanceof AppSuspendedException) {
      return this.toError(exception.message, "APP_SUSPENDED");
    }
    if (exception instanceof HttpException) {
      const code = this.codeFromStatus(exception.getStatus());
      const response = exception.getResponse();
      const extra =
        typeof response === "object" && response !== null
          ? (response as Record<string, unknown>)
          : {};
      const {
        message: _message,
        statusCode: _status,
        error: _error,
        ...rest
      } = extra;
      return this.toError(httpExceptionMessage(exception), code, rest);
    }
    console.error(
      "[graphql] unhandled:",
      exception instanceof Error ? exception.stack : exception,
    );
    return this.toError("Terjadi kesalahan pada server.", "INTERNAL_ERROR");
  }

  /** Respons JSON konsisten untuk endpoint REST (uploads, media, 404). */
  private handleHttp(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppNotFoundException) {
      res.status(HttpStatus.NOT_FOUND).json({
        message: exception.message,
        code: "APP_NOT_FOUND",
      });
      return;
    }
    if (exception instanceof AppSuspendedException) {
      res.status(HttpStatus.FORBIDDEN).json({
        message: exception.message,
        code: "APP_SUSPENDED",
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json({
        message: httpExceptionMessage(exception),
        code: this.codeFromStatus(status),
      });
      return;
    }

    console.error(
      "[http] unhandled:",
      exception instanceof Error ? exception.stack : exception,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Terjadi kesalahan pada server.",
      code: "INTERNAL_ERROR",
    });
  }

  private codeFromStatus(status: number): string {
    return STATUS_CODES[status] ?? "INTERNAL_ERROR";
  }

  private toError(
    message: string,
    code: string,
    extra: Record<string, unknown> = {},
  ): GraphQLError {
    return new GraphQLError(message, { extensions: { code, ...extra } });
  }
}
