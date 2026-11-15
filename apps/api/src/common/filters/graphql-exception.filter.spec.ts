import { ForbiddenException } from "@nestjs/common";
import { GraphqlExceptionFilter } from "./graphql-exception.filter";

describe("GraphqlExceptionFilter", () => {
  it("meneruskan requiredPermission ke extensions", () => {
    const filter = new GraphqlExceptionFilter();
    const error = filter.catch(
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
    const error = filter.catch(new ForbiddenException("Ditolak."));
    expect(error.extensions).toEqual({ code: "FORBIDDEN" });
  });
});
