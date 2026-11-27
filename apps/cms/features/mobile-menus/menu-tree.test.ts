import { describe, expect, test } from "bun:test";
import { buildMenuTree, excludedParentIds } from "./menu-tree";
import type { MobileMenuData } from "./graphql/mobile-menus.graphql";

function menu(
  id: string,
  parentId: string | null,
  orderNo: number,
  name = id,
): MobileMenuData {
  return {
    id,
    appId: "1",
    name,
    slug: id,
    routeKey: null,
    iconKey: null,
    parentId,
    orderNo,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildMenuTree", () => {
  test("daftar kosong menghasilkan pohon kosong", () => {
    expect(buildMenuTree([])).toEqual([]);
  });

  test("menu tanpa parent menjadi akar urut orderNo lalu id", () => {
    const tree = buildMenuTree([
      menu("20", null, 1, "B"),
      menu("10", null, 1, "A"),
      menu("30", null, 0, "C"),
    ]);
    expect(tree.map((n) => n.menu.name)).toEqual(["C", "A", "B"]);
  });

  test("submenu menempel ke parent dan urut di dalam sibling", () => {
    const tree = buildMenuTree([
      menu("1", null, 0, "Induk"),
      menu("3", "1", 2, "Sub B"),
      menu("2", "1", 1, "Sub A"),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.menu.name).toBe("Induk");
    expect(tree[0]?.children.map((n) => n.menu.name)).toEqual([
      "Sub A",
      "Sub B",
    ]);
  });

  test("dua tingkat bersarang dipertahankan", () => {
    const tree = buildMenuTree([
      menu("1", null, 0, "Induk"),
      menu("2", "1", 0, "Sub"),
      menu("3", "2", 0, "Cucu"),
    ]);
    expect(tree[0]?.children[0]?.children[0]?.menu.name).toBe("Cucu");
  });

  test("urutan seri diputus dengan id numerik", () => {
    const tree = buildMenuTree([
      menu("9", null, 5, "Sembilan"),
      menu("10", null, 5, "Sepuluh"),
    ]);
    expect(tree.map((n) => n.menu.name)).toEqual(["Sembilan", "Sepuluh"]);
  });
});

describe("excludedParentIds", () => {
  test("mengembalikan himpunan kosong saat membuat menu baru", () => {
    const menus = [menu("1", null, 0), menu("2", "1", 0)];
    expect(excludedParentIds(menus, null)).toEqual(new Set());
  });

  test("mengecualikan diri sendiri dan seluruh keturunannya", () => {
    const menus = [
      menu("1", null, 0, "Induk"),
      menu("2", "1", 0, "Sub"),
      menu("3", "2", 0, "Cucu"),
      menu("4", null, 0, "Lain"),
    ];
    expect(excludedParentIds(menus, "1")).toEqual(new Set(["1", "2", "3"]));
    expect(excludedParentIds(menus, "2")).toEqual(new Set(["2", "3"]));
  });
});
