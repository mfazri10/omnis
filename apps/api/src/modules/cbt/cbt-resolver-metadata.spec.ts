import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../common/guards/app-context.guard";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { CbtPackagesResolver } from "./packages.resolver";
import { CbtQuestionsResolver } from "./questions.resolver";
import { CbtSessionsResolver } from "./sessions.resolver";

const reflector = new Reflector();

function permsOf(target: object, method: string): string[] | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[method];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<string[]>(PERMISSIONS_KEY, fn);
}

function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata("__guards__", target) as unknown[]) ?? [];
}

function scopedOf(target: object, method: string): boolean | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[method];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<boolean>(APP_SCOPED_KEY, fn);
}

const RESOLVERS = [
  CbtQuestionsResolver,
  CbtPackagesResolver,
  CbtSessionsResolver,
];

describe("Resolver CBT metadata (pola modul baku F12)", () => {
  it.each(RESOLVERS)("dikunci AuthGuard + AppContextGuard + PermissionGuard urut", (resolver) => {
    expect(guardsOf(resolver)).toEqual([AuthGuard, AppContextGuard, PermissionGuard]);
  });

  it("operasi soal: view untuk baca, manage untuk tulis, semua app-scoped", () => {
    const proto = CbtQuestionsResolver.prototype;
    expect(permsOf(proto, "cbtQuestions")).toEqual(["cbt.questions.view"]);
    expect(permsOf(proto, "cbtQuestion")).toEqual(["cbt.questions.view"]);
    for (const method of ["createCbtQuestion", "updateCbtQuestion", "setCbtQuestionActive"]) {
      expect(permsOf(proto, method)).toEqual(["cbt.questions.manage"]);
      expect(scopedOf(proto, method)).toBe(true);
    }
    expect(scopedOf(proto, "cbtQuestions")).toBe(true);
  });

  it("operasi paket: view untuk baca, manage untuk tulis, semua app-scoped", () => {
    const proto = CbtPackagesResolver.prototype;
    expect(permsOf(proto, "cbtPackages")).toEqual(["cbt.packages.view"]);
    expect(permsOf(proto, "cbtPackage")).toEqual(["cbt.packages.view"]);
    for (const method of ["createCbtPackage", "updateCbtPackage", "setCbtPackageQuestions"]) {
      expect(permsOf(proto, method)).toEqual(["cbt.packages.manage"]);
      expect(scopedOf(proto, method)).toBe(true);
    }
  });

  it("operasi sesi/hasil: sessions.view/manage dan results.view, semua app-scoped", () => {
    const proto = CbtSessionsResolver.prototype;
    expect(permsOf(proto, "cbtSessions")).toEqual(["cbt.sessions.view"]);
    expect(permsOf(proto, "cbtSession")).toEqual(["cbt.sessions.view"]);
    for (const method of ["startCbtSimulation", "submitCbtAnswers", "finishCbtSession"]) {
      expect(permsOf(proto, method)).toEqual(["cbt.sessions.manage"]);
      expect(scopedOf(proto, method)).toBe(true);
    }
    expect(permsOf(proto, "cbtResults")).toEqual(["cbt.results.view"]);
    expect(permsOf(proto, "cbtPackageStats")).toEqual(["cbt.results.view"]);
    expect(scopedOf(proto, "cbtResults")).toBe(true);
    expect(scopedOf(proto, "cbtPackageStats")).toBe(true);
  });
});
