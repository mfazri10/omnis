import type { MobileMenuData } from "./graphql/mobile-menus.graphql";

export interface MenuTreeNode {
  menu: MobileMenuData;
  children: MenuTreeNode[];
}

function compareSiblings(a: MobileMenuData, b: MobileMenuData): number {
  if (a.orderNo !== b.orderNo) return a.orderNo - b.orderNo;
  return Number(a.id) - Number(b.id);
}

/** Susun daftar datar menjadi pohon; sibling urut orderNo lalu id. */
export function buildMenuTree(rows: readonly MobileMenuData[]): MenuTreeNode[] {
  const nodes = new Map<string, MenuTreeNode>(
    rows.map((menu) => [menu.id, { menu, children: [] }]),
  );
  const roots: MenuTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent =
      node.menu.parentId === null ? undefined : nodes.get(node.menu.parentId);
    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }
  const sortTree = (items: MenuTreeNode[]): MenuTreeNode[] => {
    items.sort((a, b) => compareSiblings(a.menu, b.menu));
    for (const item of items) sortTree(item.children);
    return items;
  };
  return sortTree(roots);
}

/**
 * ID yang tidak boleh dipakai sebagai parent saat mengubah menu:
 * menu itu sendiri beserta seluruh keturunannya (mencegah siklus).
 * `editingId === null` (membuat menu baru) tidak mengecualikan apa pun.
 */
export function excludedParentIds(
  rows: readonly MobileMenuData[],
  editingId: string | null,
): Set<string> {
  if (editingId === null) return new Set();
  const childrenOf = new Map<string, string[]>();
  for (const menu of rows) {
    if (menu.parentId === null) continue;
    const list = childrenOf.get(menu.parentId) ?? [];
    list.push(menu.id);
    childrenOf.set(menu.parentId, list);
  }
  const excluded = new Set<string>();
  const stack = [editingId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    excluded.add(current);
    for (const child of childrenOf.get(current) ?? []) {
      if (!excluded.has(child)) stack.push(child);
    }
  }
  return excluded;
}
