import { Query, Resolver } from "@nestjs/graphql";

@Resolver()
export class MetaResolver {
  @Query(() => String, {
    description: "Versi API — dipakai CMS sebagai bukti koneksi GraphQL (F00).",
  })
  apiVersion(): string {
    return "0.0.0";
  }
}
