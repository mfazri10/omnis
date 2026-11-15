import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import { GqlExceptionFilter } from "@nestjs/graphql";
import { GraphQLError } from "graphql";
import {
  AppNotFoundException,
  AppSuspendedException,
} from "../exceptions/app.exceptions";

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.UNAUTHORIZED]: "UNAUTHENTICATED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.BAD_REQUEST]: "BAD_USER_INPUT",
  [HttpStatus.CONFLICT]: "CONFLICT",
};

/** Memetakan exception ke extensions.code stabil (doc 07 §1). */
@Catch()
export class GraphqlExceptionFilter implements GqlExceptionFilter {
  catch(exception: unknown): GraphQLError {
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
      return this.toError(exception.message, code, rest);
    }
    console.error(
      "[graphql] unhandled:",
      exception instanceof Error ? exception.stack : exception,
    );
    return this.toError("Terjadi kesalahan pada server.", "INTERNAL_ERROR");
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
