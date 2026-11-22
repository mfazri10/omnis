import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { ActivityLogsExportResolver } from "./activity-logs-export.resolver";
import { AppUsersExportResolver } from "./app-users-export.resolver";
import { CbtResultsExportResolver } from "./cbt-results-export.resolver";
import { ExportJobsResolver } from "./export-jobs.resolver";

const reflector = new Reflector();

function permsOf(target: object, method: string): string[] | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[
    method
  ];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<string[]>(PERMISSIONS_KEY, fn);
}

function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata("__guards__", target) as unknown[]) ?? [];
}

function scopedOf(target: object, method: string): boolean | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[
    method
  ];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<boolean>(APP_SCOPED_KEY, fn);
}

describe("AppUsersExportResolver metadata", () => {
  it("dikunci AuthGuard + AppContextGuard + PermissionGuard urut", () => {
    expect(guardsOf(AppUsersExportResolver)).toEqual([
      AuthGuard,
      AppContextGuard,
      PermissionGuard,
    ]);
  });

  it("exportAppUsers → platform.users.view + @AppScoped", () => {
    expect(permsOf(AppUsersExportResolver.prototype, "exportAppUsers")).toEqual(
      ["platform.users.view"],
    );
    expect(scopedOf(AppUsersExportResolver.prototype, "exportAppUsers")).toBe(
      true,
    );
  });

  it("argumen exportAppUsers menerima filter tanpa ditolak whitelist", async () => {
    const { ValidationPipe } = await import("@nestjs/common");
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const { ExportAppUsersArgs } = await import("./dto/export.input");
    const transformed = (await pipe.transform(
      { filter: { search: "budi", status: "active" } },
      { type: "body", metatype: ExportAppUsersArgs },
    )) as InstanceType<typeof ExportAppUsersArgs>;

    expect(transformed.filter?.search).toBe("budi");
    expect(transformed.filter?.status).toBe("active");
  });
});

describe("CbtResultsExportResolver metadata", () => {
  it("dikunci AuthGuard + AppContextGuard + PermissionGuard urut", () => {
    expect(guardsOf(CbtResultsExportResolver)).toEqual([
      AuthGuard,
      AppContextGuard,
      PermissionGuard,
    ]);
  });

  it("exportCbtResults → cbt.results.view + @AppScoped", () => {
    expect(
      permsOf(CbtResultsExportResolver.prototype, "exportCbtResults"),
    ).toEqual(["cbt.results.view"]);
    expect(
      scopedOf(CbtResultsExportResolver.prototype, "exportCbtResults"),
    ).toBe(true);
  });

  it("argumen exportCbtResults menerima filter tanpa ditolak whitelist", async () => {
    const { ValidationPipe } = await import("@nestjs/common");
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const { ExportCbtResultsArgs } = await import("./dto/export.input");
    const transformed = (await pipe.transform(
      { filter: { packageId: "1", passed: true } },
      { type: "body", metatype: ExportCbtResultsArgs },
    )) as InstanceType<typeof ExportCbtResultsArgs>;

    expect(transformed.filter?.packageId).toBe("1");
    expect(transformed.filter?.passed).toBe(true);
  });
});

describe("ActivityLogsExportResolver metadata", () => {
  it("dikunci AuthGuard + PermissionGuard urut", () => {
    expect(guardsOf(ActivityLogsExportResolver)).toEqual([
      AuthGuard,
      PermissionGuard,
    ]);
  });

  it("exportActivityLogs → platform.audit.view dan bukan app-scoped", () => {
    expect(
      permsOf(ActivityLogsExportResolver.prototype, "exportActivityLogs"),
    ).toEqual(["platform.audit.view"]);
    expect(
      scopedOf(ActivityLogsExportResolver.prototype, "exportActivityLogs"),
    ).toBeUndefined();
  });

  it("argumen exportActivityLogs menerima filter tanpa ditolak whitelist", async () => {
    const { ValidationPipe } = await import("@nestjs/common");
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const { ExportActivityLogsArgs } = await import("./dto/export.input");
    const transformed = (await pipe.transform(
      { filter: { appId: "1", action: "create" } },
      { type: "body", metatype: ExportActivityLogsArgs },
    )) as InstanceType<typeof ExportActivityLogsArgs>;

    expect(transformed.filter?.appId).toBe("1");
    expect(transformed.filter?.action).toBe("create");
  });
});

describe("ExportJobsResolver metadata", () => {
  it("dikunci AuthGuard saja (kepemilikan dipaksa di service)", () => {
    expect(guardsOf(ExportJobsResolver)).toEqual([AuthGuard]);
  });

  it("exportJob dan exportJobs tanpa permission khusus", () => {
    expect(permsOf(ExportJobsResolver.prototype, "exportJob")).toBeUndefined();
    expect(permsOf(ExportJobsResolver.prototype, "exportJobs")).toBeUndefined();
  });
});
