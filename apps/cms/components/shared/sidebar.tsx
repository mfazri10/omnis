"use client";

import type { JSX } from "react";
import { GLOBAL_MENU, appMenu } from "../../features/shell/menu";
import type { MenuItem } from "../../features/shell/menu";
import { useSessionStore } from "../../stores/use-session-store";

function isVisible(
  item: MenuItem,
  isSuperAdmin: boolean,
  permissions: string[],
): boolean {
  if (item.requires === null || isSuperAdmin) {
    return true;
  }
  return permissions.includes(item.requires);
}

function MenuList({ items }: { items: MenuItem[] }): JSX.Element {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.key}>
          {item.href === null ? (
            <span className="flex min-h-[44px] items-center justify-between px-3 py-2 text-sm text-slate-400">
              {item.label}
              <span className="text-xs">Segera</span>
            </span>
          ) : (
            <a
              className="flex min-h-[44px] items-center px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
              href={item.href}
            >
              {item.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Sidebar(): JSX.Element {
  const admin = useSessionStore((state) => state.admin);
  const permissions = useSessionStore((state) => state.permissions);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const apps = useSessionStore((state) => state.accessibleApps);
  const isSuperAdmin = admin?.isSuperAdmin ?? false;
  const globalItems = GLOBAL_MENU.filter((item) =>
    isVisible(item, isSuperAdmin, permissions),
  );
  const activeApp = apps.find((app) => app.slug === activeSlug) ?? null;
  const contextItems =
    activeSlug === null
      ? []
      : appMenu(activeSlug).filter((item) =>
          isVisible(item, isSuperAdmin, permissions),
        );
  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-6">
      <section>
        <h2 className="px-3 text-xs font-semibold uppercase text-slate-500">
          Platform
        </h2>
        <div className="mt-2">
          <MenuList items={globalItems} />
        </div>
      </section>
      {activeApp !== null && (
        <section>
          <h2 className="px-3 text-xs font-semibold uppercase text-slate-500">
            {activeApp.name}
          </h2>
          <div className="mt-2">
            <MenuList items={contextItems} />
          </div>
        </section>
      )}
    </nav>
  );
}
