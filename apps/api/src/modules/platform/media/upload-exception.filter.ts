import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import {
  AppNotFoundException,
  AppSuspendedException,
} from "../../../common/exceptions/app.exceptions";
import { httpExceptionMessage } from "../../../common/filters/http-exception-message";

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "BAD_USER_INPUT",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHENTICATED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.PAYLOAD_TOO_LARGE]: "PAYLOAD_TOO_LARGE",
};

interface ErrorBody {
  message: string;
  code: string;
  requiredPermission?: string;
}

/** Format error REST konsisten {message, code} (cermin filter GraphQL). */
@Catch()
export class UploadExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AppNotFoundException) {
      this.send(res, HttpStatus.NOT_FOUND, exception.message, "APP_NOT_FOUND");
      return;
    }
    if (exception instanceof AppSuspendedException) {
      this.send(res, HttpStatus.FORBIDDEN, exception.message, "APP_SUSPENDED");
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_CODES[status] ?? "INTERNAL_ERROR";
      const response = exception.getResponse();
      const extra =
        typeof response === "object" && response !== null
          ? (response as Record<string, unknown>)
          : {};
      const requiredPermission =
        typeof extra.requiredPermission === "string"
          ? extra.requiredPermission
          : undefined;
      const message =
        status >= 500
          ? "Terjadi kesalahan pada server."
          : httpExceptionMessage(exception);
      this.send(res, status, message, code, requiredPermission);
      return;
    }
    console.error(
      "[uploads] unhandled:",
      exception instanceof Error ? exception.stack : exception,
    );
    this.send(res, 500, "Terjadi kesalahan pada server.", "INTERNAL_ERROR");
  }

  private send(
    res: Response,
    status: number,
    message: string,
    code: string,
    requiredPermission?: string,
  ): void {
    const body: ErrorBody = { message, code };
    if (requiredPermission !== undefined) {
      body.requiredPermission = requiredPermission;
    }
    res.status(status).json(body);
  }
}
