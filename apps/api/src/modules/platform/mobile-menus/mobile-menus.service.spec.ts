import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { DatabaseService } from "../../../database/database.service";
import type { Db } from "../../../database/database.service";
import { menus } from "../entities/mobile-menus.entity";
import type { MobileMenuRow } from "../entities/mobile-menus.entity";
import { MobileMenusRepository } from "./mobile-menus.repository";
import { MobileMenusService } from "./mobile-menus.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };
type ScopedMenuDb = Pick<Db, "select" | "insert" | "update" | "delete">;
type RepositoryWithAppLock = MobileMenusRepository & {
  withAppLock<T>(
    db: Db,
    appId: number,
    operation: (transaction: ScopedMenuDb) => Promise<T>,
  ): Promise<T>;
};

function makeService(): {
  service: MobileMenusService;
  repository: Mocked<MobileMenusRepository> & { withAppLock: jest.Mock };
} {
  const withAppLock = jest.fn(
    (
      _db: unknown,
      _appId: number,
      operation: (transaction: ScopedMenuDb) => Promise<unknown>,
    ) => operation({} as ScopedMenuDb),
  );
  const repository = {
    listByAppId: jest.fn().mockResolvedValue([]),
    findByAppIdAndId: jest.fn(),
    findByAppIdAndSlug: jest.fn().mockResolvedValue(null),
    listByParentId: jest.fn().mockResolvedValue([]),
    insert: jest.fn(),
    updateByAppIdAndId: jest.fn(),
    deleteByAppIdAndId: jest.fn(),
    withAppLock,
  } as unknown as Mocked<MobileMenusRepository> & { withAppLock: jest.Mock };
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue({}),
  } as unknown as DatabaseService;
  return {
    service: new MobileMenusService(database, repository),
    repository,
  };
}

function menuRow(over: Partial<MobileMenuRow> = {}): MobileMenuRow {
  return {
    id: 1,
    appId: 7,
    name: "Beranda",
    slug: "beranda",
    routeKey: "home",
    iconKey: "home",
    parentId: null,
    orderNo: 0,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

function menuQuery(rows: MobileMenuRow[] = []): {
  db: Db;
  filter: () => SQL;
  orderBy: jest.Mock;
  limit: jest.Mock;
} {
  let capturedFilter: SQL | undefined;
  const query: {
    where: (condition: SQL) => typeof query;
    orderBy: jest.Mock;
    limit: jest.Mock;
  } = {
    where(condition) {
      capturedFilter = condition;
      return query;
    },
    orderBy: jest.fn().mockResolvedValue(rows),
    limit: jest.fn().mockResolvedValue(rows),
  };
  const db = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    }),
  } as unknown as Db;
  return {
    db,
    filter: () => {
      if (capturedFilter === undefined) {
        throw new Error("Where condition was not captured.");
      }
      return capturedFilter;
    },
    orderBy: query.orderBy,
    limit: query.limit,
  };
}

describe("MobileMenusRepository", () => {
  it("locks the app row in a transaction before hierarchy updates", async () => {
    const repository = new MobileMenusRepository() as RepositoryWithAppLock;
    let capturedFilter: SQL | undefined;
    let lockMode: string | undefined;
    const lockQuery = {
      for: jest.fn((mode: string) => {
        lockMode = mode;
        return Promise.resolve([]);
      }),
    };
    const transaction: ScopedMenuDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn((condition: SQL) => {
            capturedFilter = condition;
            return lockQuery;
          }),
        })),
      })),
    } as unknown as ScopedMenuDb;
    const db = {
      transaction: jest.fn(
        (operation: (tx: ScopedMenuDb) => Promise<string>) =>
          operation(transaction),
      ),
    } as unknown as Db;

    expect(typeof repository.withAppLock).toBe("function");
    if (typeof repository.withAppLock !== "function") {
      return;
    }

    const result = await repository.withAppLock(db, 7, () =>
      Promise.resolve(lockMode),
    );

    expect(result).toBe("update");
    expect(capturedFilter).toBeDefined();
    expect(
      new PgDialect().sqlToQuery(capturedFilter as SQL).params,
    ).toContain(7);
  });

  it("scopes list to app and orders by orderNo then id", async () => {
    const repository = new MobileMenusRepository();
    const { db, filter, orderBy } = menuQuery();

    await repository.listByAppId(db, 7);

    expect(new PgDialect().sqlToQuery(filter()).params).toContain(7);
    expect(orderBy).toHaveBeenCalledWith(menus.orderNo, menus.id);
  });

  it("scopes ID lookup to both app and menu", async () => {
    const repository = new MobileMenusRepository();
    const { db, filter } = menuQuery([menuRow()]);

    await repository.findByAppIdAndId(db, 7, 9);

    expect(new PgDialect().sqlToQuery(filter()).params).toEqual(
      expect.arrayContaining([7, 9]),
    );
  });

  it("scopes slug lookup to both app and slug", async () => {
    const repository = new MobileMenusRepository();
    const { db, filter } = menuQuery([menuRow()]);

    await repository.findByAppIdAndSlug(db, 7, "beranda");

    const query = new PgDialect().sqlToQuery(filter());
    expect(query.params).toContain(7);
    expect(query.params).toContain("beranda");
  });
});

describe("MobileMenusService", () => {
  it("lists only the app from the control-plane context", async () => {
    const { service, repository } = makeService();
    const row = menuRow();
    repository.listByAppId.mockResolvedValue([row]);

    await expect(service.list("7")).resolves.toEqual([row]);
    expect(repository.listByAppId).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it("rejects a duplicate slug during creation", async () => {
    const { service, repository } = makeService();
    repository.findByAppIdAndSlug.mockResolvedValue(menuRow());

    await expect(
      service.create("7", { name: "Beranda", slug: "beranda" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("maps a concurrent duplicate-slug insert to conflict", async () => {
    const { service, repository } = makeService();
    repository.insert.mockRejectedValue(
      Object.assign(new Error("duplicate"), {
        code: "23505",
        constraint: "menus_app_slug_uk",
      }),
    );

    await expect(
      service.create("7", { name: "Beranda", slug: "beranda" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("does not translate an unidentified unique violation to slug conflict", async () => {
    const { service, repository } = makeService();
    const error = Object.assign(new Error("unidentified unique violation"), {
      code: "23505",
    });
    repository.insert.mockRejectedValue(error);

    await expect(
      service.create("7", { name: "Beranda", slug: "beranda" }),
    ).rejects.toBe(error);
  });

  it("rejects a parent that is not in the current app", async () => {
    const { service, repository } = makeService();
    repository.findByAppIdAndId.mockResolvedValue(null);

    await expect(
      service.create("7", {
        name: "Materi",
        slug: "materi",
        parentId: "99",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("rejects moving a menu below one of its descendants", async () => {
    const { service, repository } = makeService();
    const byId: Record<number, MobileMenuRow> = {
      2: menuRow({ id: 2, parentId: null }),
      3: menuRow({ id: 3, parentId: 4 }),
      4: menuRow({ id: 4, parentId: 2 }),
    };
    repository.findByAppIdAndId.mockImplementation(
      (
        _db: unknown,
        _appId: number,
        id: number,
      ): Promise<MobileMenuRow | null> => Promise.resolve(byId[id] ?? null),
    );

    await expect(
      service.update("7", "2", { parentId: "3" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateByAppIdAndId).not.toHaveBeenCalled();
  });

  it("serializes concurrent parent moves so they cannot create a cycle", async () => {
    const { service, repository } = makeService();
    const rows = new Map<number, MobileMenuRow>([
      [1, menuRow({ id: 1, parentId: null })],
      [2, menuRow({ id: 2, parentId: null })],
    ]);
    repository.findByAppIdAndId.mockImplementation(
      (
        _db: unknown,
        _appId: number,
        id: number,
      ): Promise<MobileMenuRow | null> => Promise.resolve(rows.get(id) ?? null),
    );
    repository.updateByAppIdAndId.mockImplementation(
      (
        _db: unknown,
        _appId: number,
        id: number,
        patch: Partial<MobileMenuRow>,
      ): Promise<MobileMenuRow | null> => {
        const row = rows.get(id);
        if (!row) {
          return Promise.resolve(null);
        }
        const updated = { ...row, ...patch };
        rows.set(id, updated);
        return Promise.resolve(updated);
      },
    );

    let lockTail = Promise.resolve();
    repository.withAppLock.mockImplementation(
      (
        _db: unknown,
        _appId: number,
        operation: (transaction: ScopedMenuDb) => Promise<unknown>,
      ) => {
        const previous = lockTail;
        let release: () => void = () => {};
        lockTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        return previous.then(async () => {
          try {
            return await operation({} as ScopedMenuDb);
          } finally {
            release();
          }
        });
      },
    );

    const results = await Promise.allSettled([
      service.update("7", "1", { parentId: "2" }),
      service.update("7", "2", { parentId: "1" }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(
      rows.get(1)?.parentId === 2 && rows.get(2)?.parentId === 1,
    ).toBe(false);
    expect(repository.withAppLock).toHaveBeenCalledTimes(2);
  });

  it("rejects an update to another menu's slug", async () => {
    const { service, repository } = makeService();
    repository.findByAppIdAndId.mockResolvedValue(menuRow());
    repository.findByAppIdAndSlug.mockResolvedValue(menuRow({ id: 2 }));

    await expect(
      service.update("7", "1", { slug: "materi" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.updateByAppIdAndId).not.toHaveBeenCalled();
  });

  it.each(["name", "slug"])(
    "rejects an explicit null %s during update as a client error",
    async (field) => {
      const { service, repository } = makeService();
      repository.findByAppIdAndId.mockResolvedValue(menuRow());
      const input = { [field]: null } as unknown as Parameters<
        typeof service.update
      >[2];

      await expect(service.update("7", "1", input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it("maps a concurrent duplicate-slug update to conflict", async () => {
    const { service, repository } = makeService();
    repository.findByAppIdAndId.mockResolvedValue(menuRow());
    repository.findByAppIdAndSlug.mockResolvedValue(null);
    repository.updateByAppIdAndId.mockRejectedValue(
      Object.assign(new Error("duplicate"), {
        code: "23505",
        constraint: "menus_app_slug_uk",
      }),
    );

    await expect(
      service.update("7", "1", { slug: "materi" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each(["/home", "https://example.test/home", "home/items"])(
    "rejects a route key that is a path or URL: %s",
    async (routeKey) => {
      const { service, repository } = makeService();

      await expect(
        service.create("7", {
          name: "Beranda",
          slug: "beranda",
          routeKey,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.insert).not.toHaveBeenCalled();
    },
  );

  it.each(["/home", "https://example.test/icon", "icons/home"])(
    "rejects an icon key that is a path or URL: %s",
    async (iconKey) => {
      const { service, repository } = makeService();

      await expect(
        service.create("7", {
          name: "Beranda",
          slug: "beranda",
          iconKey,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.insert).not.toHaveBeenCalled();
    },
  );

  it("returns a deleted leaf and does not delete a parent", async () => {
    const { service, repository } = makeService();
    const row = menuRow();
    repository.findByAppIdAndId.mockResolvedValue(row);
    repository.listByParentId.mockResolvedValue([]);

    await expect(service.delete("7", "1")).resolves.toEqual(row);
    expect(repository.deleteByAppIdAndId).toHaveBeenCalledWith(
      expect.anything(),
      7,
      1,
    );
  });

  it("rejects deleting a menu that still has children", async () => {
    const { service, repository } = makeService();
    repository.findByAppIdAndId.mockResolvedValue(menuRow());
    repository.listByParentId.mockResolvedValue([
      menuRow({ id: 2, parentId: 1 }),
    ]);

    await expect(service.delete("7", "1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.deleteByAppIdAndId).not.toHaveBeenCalled();
  });

  it("rejects an identifier that is not a positive integer", async () => {
    const { service, repository } = makeService();

    await expect(service.list("0")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.listByAppId).not.toHaveBeenCalled();
  });
});
