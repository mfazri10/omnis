import { UseGuards } from "@nestjs/common";
import { Query, Resolver } from "@nestjs/graphql";
import { AuthGuard } from "../common/guards/auth.guard";

@Resolver()
export class MetaResolver {
  @Query(() => String, {
    description: "Versi API — dipakai CMS sebagai bukti koneksi GraphQL (F00).",
  })
  @UseGuards(AuthGuard)
  apiVersion(): string {
    return "0.0.0";
  }
}
