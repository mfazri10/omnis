import { ArgsType, Field } from "@nestjs/graphql";
import { Type } from "class-transformer";
import { IsOptional, ValidateNested } from "class-validator";
import { ActivityLogFilterInput } from "../../activity-logs/dto/activity-log.input";
import { AppUserFilterInput } from "../../app-users/dto/app-user.input";
import { CbtResultFilterInput } from "../../../cbt/dto/session.input";

/**
 * Filter ekspor user aplikasi. Filter adalah properti args, bukan
 * argumen terpisah di resolver: ValidationPipe global memakai
 * forbidNonWhitelisted (pola F06).
 */
@ArgsType()
export class ExportAppUsersArgs {
  @Field(() => AppUserFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppUserFilterInput)
  filter?: AppUserFilterInput;
}

/** Filter ekspor log audit (pola args yang sama). */
@ArgsType()
export class ExportActivityLogsArgs {
  @Field(() => ActivityLogFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ActivityLogFilterInput)
  filter?: ActivityLogFilterInput;
}

/** Filter ekspor hasil CBT (F12): sama dengan daftar hasil di layar CMS. */
@ArgsType()
export class ExportCbtResultsArgs {
  @Field(() => CbtResultFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CbtResultFilterInput)
  filter?: CbtResultFilterInput;
}
