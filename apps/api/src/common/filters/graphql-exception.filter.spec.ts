import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { GraphQLError } from "graphql";
import { GraphqlExceptionFilter } from "./graphql-exception.filter";

/** Filter mengembalikan void untuk konteks HTTP; test di bawah hanya GraphQL. */
function catchGraphql(
  filter: GraphqlExceptionFilter,
  exception: unknown,
): GraphQLError {
  return filter.catch(exception) as GraphQLError;
}

describe("GraphqlExceptionFilter", () => {
  it("meneruskan requiredPermission ke extensions", () => {
    const filter = new GraphqlExceptionFilter();
    const error = catchGraphql(
      filter,
      new ForbiddenException({
        message: "Anda tidak memiliki akses untuk tindakan ini.",
        requiredPermission: "platform.roles.manage",
      }),
    );
    expect(error.extensions).toEqual({
      code: "FORBIDDEN",
      requiredPermission: "platform.roles.manage",
    });
  });

  it("FORBIDDEN polos tanpa field tambahan", () => {
    const filter = new GraphqlExceptionFilter();
    const error = catchGraphql(filter, new ForbiddenException("Ditolak."));
    expect(error.extensions).toEqual({ code: "FORBIDDEN" });
  });

  it("ConflictException → code CONFLICT", () => {
    const filter = new GraphqlExceptionFilter();
    const error = catchGraphql(
      filter,
      new ConflictException("Penetapan role ini sudah ada."),
    );
    expect(error.extensions).toEqual({ code: "CONFLICT" });
  });
});

describe("GraphqlExceptionFilter pada konteks HTTP", () => {
  function fakeHost(): {
    host: import("@nestjs/common").ArgumentsHost;
    status: jest.Mock;
    json: jest.Mock;
  } {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res = { status };
    const host = {
      getType: () => "http",
      switchToHttp: () => ({ getResponse: () => res }),
    } as unknown as import("@nestjs/common").ArgumentsHost;
    return { host, status, json };
  }

  /**
   * Regresi: filter ini global (APP_FILTER). Sebelum perbaikan, request HTTP
   * yang tidak cocok rute (404) menggantung tanpa respons sama sekali karena
   * yang dikembalikan adalah GraphQLError, bukan respons Express.
   */
  it("404 HTTP dijawab JSON, bukan menggantung", () => {
    const { host, status, json } = fakeHost();
    const filter = new GraphqlExceptionFilter();

    filter.catch(new NotFoundException("Cannot GET /tidak-ada"), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });
});
