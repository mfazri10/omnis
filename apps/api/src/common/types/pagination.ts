import type { Type } from "@nestjs/common";
import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { Max, Min } from "class-validator";

/** Satu-satunya bentuk daftar di API (doc 07): skip/take + totalCount. */
@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { defaultValue: 0 })
  @Min(0)
  skip = 0;

  @Field(() => Int, { defaultValue: 20 })
  @Min(1)
  @Max(50)
  take = 20;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- mixin GraphQL resmi NestJS, tipenya tidak bisa diekspresikan
export function PaginatedType<TItem>(ItemType: Type<TItem>) {
  @ObjectType({ isAbstract: true })
  abstract class Paginated {
    @Field(() => [ItemType])
    items!: TItem[];

    @Field(() => Int)
    totalCount!: number;
  }
  return Paginated;
}
