import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../../database/database.service";
import type { Db } from "../../../database/database.service";
import type { MobileMenuRow } from "../entities/mobile-menus.entity";
import { MobileMenusRepository } from "./mobile-menus.repository";
import type {
  CreateMobileMenuRow,
  UpdateMobileMenuRow,
} from "./mobile-menus.repository";

export interface CreateMobileMenuInput {
  name: string;
  slug: string;
  routeKey?: string | null;
  iconKey?: string | null;
  parentId?: string | null;
  orderNo?: number;
  isActive?: boolean;
}

export interface UpdateMobileMenuInput {
  name?: string;
  slug?: string;
  routeKey?: string | null;
  iconKey?: string | null;
  parentId?: string | null;
  orderNo?: number;
  isActive?: boolean;
}

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,254}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseId(value: string, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`${label} tidak valid.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`${label} tidak valid.`);
  }
  return parsed;
}

function parseName(value: string): string {
  const name = value.trim();
  if (name.length === 0 || name.length > 255) {
    throw new BadRequestException("Nama menu harus berisi 1 sampai 255 karakter.");
  }
  return name;
}

function parseSlug(value: string): string {
  const slug = value.trim();
  if (slug.length > 255 || !SLUG_PATTERN.test(slug)) {
    throw new BadRequestException(
      "Slug harus berupa huruf kecil, angka, dan tanda hubung.",
    );
  }
  return slug;
}

function parseIdentifier(
  value: string | null | undefined,
  label: string,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new BadRequestException(
      `${label} harus berupa identifier, bukan URL atau path.`,
    );
  }
  return value;
}

function parseOrderNo(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestException("Nomor urut harus berupa bilangan bulat non-negatif.");
  }
  return value;
}

function isSlugUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  if (error.code !== "23505") {
    return false;
  }
  return "constraint" in error && error.constraint === "menus_app_slug_uk";
}

@Injectable()
export class MobileMenusService {
  constructor(
    private readonly database: DatabaseService,
    private readonly menus: MobileMenusRepository,
  ) {}

  async list(appId: string): Promise<MobileMenuRow[]> {
    const db = this.database.getControlPlaneConnection();
    return this.menus.listByAppId(db, parseId(appId, "ID aplikasi"));
  }

  async create(
    appId: string,
    input: CreateMobileMenuInput,
  ): Promise<MobileMenuRow> {
    const db = this.database.getControlPlaneConnection();
    const numericAppId = parseId(appId, "ID aplikasi");
    const row: CreateMobileMenuRow = {
      appId: numericAppId,
      name: parseName(input.name),
      slug: parseSlug(input.slug),
      routeKey: parseIdentifier(input.routeKey, "routeKey") ?? null,
      iconKey: parseIdentifier(input.iconKey, "iconKey") ?? null,
      parentId: await this.resolveParentId(db, numericAppId, input.parentId),
      orderNo: parseOrderNo(input.orderNo ?? 0),
      isActive: input.isActive ?? true,
    };
    await this.ensureSlugAvailable(db, numericAppId, row.slug);
    try {
      return await this.menus.insert(db, row);
    } catch (error: unknown) {
      if (isSlugUniqueViolation(error)) {
        throw new ConflictException("Slug menu sudah digunakan pada aplikasi ini.");
      }
      throw error;
    }
  }

  async update(
    appId: string,
    id: string,
    input: UpdateMobileMenuInput,
  ): Promise<MobileMenuRow> {
    const db = this.database.getControlPlaneConnection();
    const numericAppId = parseId(appId, "ID aplikasi");
    const numericId = parseId(id, "ID menu");
    const current = await this.mustFind(db, numericAppId, numericId);
    const patch: UpdateMobileMenuRow = {};

    if (input.name !== undefined) {
      patch.name = parseName(input.name);
    }
    if (input.slug !== undefined) {
      patch.slug = parseSlug(input.slug);
      await this.ensureSlugAvailable(db, numericAppId, patch.slug, numericId);
    }
    if (input.routeKey !== undefined) {
      patch.routeKey = parseIdentifier(input.routeKey, "routeKey") ?? null;
    }
    if (input.iconKey !== undefined) {
      patch.iconKey = parseIdentifier(input.iconKey, "iconKey") ?? null;
    }
    if (input.parentId !== undefined) {
      patch.parentId =
        input.parentId === null
          ? null
          : await this.resolveParentId(
              db,
              numericAppId,
              input.parentId,
              numericId,
            );
      if (patch.parentId !== null) {
        await this.assertNoCycle(db, numericAppId, numericId, patch.parentId);
      }
    }
    if (input.orderNo !== undefined) {
      patch.orderNo = parseOrderNo(input.orderNo);
    }
    if (input.isActive !== undefined) {
      if (typeof input.isActive !== "boolean") {
        throw new BadRequestException("Status aktif menu tidak valid.");
      }
      patch.isActive = input.isActive;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException("Tidak ada perubahan menu.");
    }

    try {
      const updated = await this.menus.updateByAppIdAndId(
        db,
        numericAppId,
        numericId,
        patch,
      );
      if (!updated) {
        throw new NotFoundException("Menu mobile tidak ditemukan.");
      }
      return updated;
    } catch (error: unknown) {
      if (isSlugUniqueViolation(error)) {
        throw new ConflictException("Slug menu sudah digunakan pada aplikasi ini.");
      }
      throw error;
    }
  }

  async delete(appId: string, id: string): Promise<MobileMenuRow> {
    const db = this.database.getControlPlaneConnection();
    const numericAppId = parseId(appId, "ID aplikasi");
    const numericId = parseId(id, "ID menu");
    const menu = await this.mustFind(db, numericAppId, numericId);
    const children = await this.menus.listByParentId(
      db,
      numericAppId,
      numericId,
    );
    if (children.length > 0) {
      throw new BadRequestException(
        "Menu yang masih memiliki submenu tidak dapat dihapus.",
      );
    }
    await this.menus.deleteByAppIdAndId(db, numericAppId, numericId);
    return menu;
  }

  private async ensureSlugAvailable(
    db: Db,
    appId: number,
    slug: string,
    exceptId?: number,
  ): Promise<void> {
    const existing = await this.menus.findByAppIdAndSlug(db, appId, slug);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException("Slug menu sudah digunakan pada aplikasi ini.");
    }
  }

  private async resolveParentId(
    db: Db,
    appId: number,
    parentId: string | null | undefined,
    menuId?: number,
  ): Promise<number | null> {
    if (parentId === undefined || parentId === null) {
      return null;
    }
    const numericParentId = parseId(parentId, "ID parent");
    if (numericParentId === menuId) {
      throw new BadRequestException("Menu tidak dapat menjadi parent dirinya sendiri.");
    }
    const parent = await this.menus.findByAppIdAndId(
      db,
      appId,
      numericParentId,
    );
    if (!parent || parent.appId !== appId) {
      throw new BadRequestException(
        "Parent menu tidak ditemukan pada aplikasi ini.",
      );
    }
    return numericParentId;
  }

  private async assertNoCycle(
    db: Db,
    appId: number,
    menuId: number,
    parentId: number,
  ): Promise<void> {
    let parent = await this.menus.findByAppIdAndId(db, appId, parentId);
    const seen = new Set<number>();
    while (parent) {
      if (parent.id === menuId || seen.has(parent.id)) {
        throw new BadRequestException("Relasi parent menu tidak boleh bersiklus.");
      }
      seen.add(parent.id);
      if (parent.parentId === null) {
        return;
      }
      parent = await this.menus.findByAppIdAndId(
        db,
        appId,
        parent.parentId,
      );
    }
  }

  private async mustFind(
    db: Db,
    appId: number,
    id: number,
  ): Promise<MobileMenuRow> {
    const menu = await this.menus.findByAppIdAndId(db, appId, id);
    if (!menu) {
      throw new NotFoundException("Menu mobile tidak ditemukan.");
    }
    return menu;
  }
}
