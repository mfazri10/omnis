import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../../database/database.service";
import type { Db } from "../../../database/database.service";
import type { AppRow } from "../entities/apps.entity";
import type { AppConfigRow } from "../entities/app-configs.entity";
import { AppConfigsRepository } from "../apps/app-configs.repository";
import type { UpdateAppConfigRow } from "../apps/app-configs.repository";
import { AppsRepository } from "../apps/apps.repository";

export interface EffectiveAppConfig {
  appId: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  minVersionAndroid: string;
  minVersionIos: string;
  themePrimaryColor: string;
  logoMediaUrl: string | null;
  supportEmail: string | null;
  supportWhatsapp: string | null;
  updatedAt: Date;
  displayName: string;
  slug: string;
  iconMediaUrl: string | null;
  storeUrlAndroid: string | null;
  storeUrlIos: string | null;
}

export interface UpdateAppConfigPatch {
  maintenanceMode: boolean;
  maintenanceMessage?: string | null;
  minVersionAndroid?: string;
  minVersionIos?: string;
  themePrimaryColor?: string;
  logoMediaUrl?: string | null;
  supportEmail?: string | null;
  supportWhatsapp?: string | null;
}

function toEffective(app: AppRow, config: AppConfigRow): EffectiveAppConfig {
  return {
    appId: String(app.id),
    maintenanceMode: config.maintenanceMode,
    maintenanceMessage: config.maintenanceMessage,
    minVersionAndroid: config.minVersionAndroid,
    minVersionIos: config.minVersionIos,
    themePrimaryColor: config.themePrimaryColor,
    logoMediaUrl: config.logoMediaUrl,
    supportEmail: config.supportEmail,
    supportWhatsapp: config.supportWhatsapp,
    updatedAt: config.updatedAt,
    displayName: app.name,
    slug: app.slug,
    iconMediaUrl: config.logoMediaUrl ?? app.iconMediaUrl,
    storeUrlAndroid: app.storeUrlAndroid,
    storeUrlIos: app.storeUrlIos,
  };
}

@Injectable()
export class AppConfigService {
  constructor(
    private readonly database: DatabaseService,
    private readonly apps: AppsRepository,
    private readonly configs: AppConfigsRepository,
  ) {}

  async getConfig(appId: string): Promise<AppConfigRow> {
    const db = this.database.getControlPlaneConnection();
    const app = await this.mustFindApp(db, appId);
    return this.mustFindConfig(db, app.id);
  }

  async getEffectiveConfig(appId: string): Promise<EffectiveAppConfig> {
    const db = this.database.getControlPlaneConnection();
    const app = await this.mustFindApp(db, appId);
    const config = await this.mustFindConfig(db, app.id);
    return toEffective(app, config);
  }

  async updateConfig(
    appId: string,
    input: UpdateAppConfigPatch,
  ): Promise<EffectiveAppConfig> {
    const db = this.database.getControlPlaneConnection();
    const app = await this.mustFindApp(db, appId);
    const numericId = app.id;
    await this.mustFindConfig(db, numericId);
    const patch: UpdateAppConfigRow = {
      maintenanceMode: input.maintenanceMode,
      updatedAt: new Date(),
    };
    if (input.maintenanceMessage !== undefined) {
      patch.maintenanceMessage = input.maintenanceMessage;
    }
    if (input.minVersionAndroid !== undefined) {
      patch.minVersionAndroid = input.minVersionAndroid;
    }
    if (input.minVersionIos !== undefined) {
      patch.minVersionIos = input.minVersionIos;
    }
    if (input.themePrimaryColor !== undefined) {
      patch.themePrimaryColor = input.themePrimaryColor;
    }
    if (input.logoMediaUrl !== undefined) {
      patch.logoMediaUrl = input.logoMediaUrl;
    }
    if (input.supportEmail !== undefined) {
      patch.supportEmail = input.supportEmail;
    }
    if (input.supportWhatsapp !== undefined) {
      patch.supportWhatsapp = input.supportWhatsapp;
    }
    await this.configs.updateByAppId(db, numericId, patch);
    const config = await this.configs.findByAppId(db, numericId);
    if (!config) {
      throw new NotFoundException("Konfigurasi aplikasi tidak ditemukan.");
    }
    return toEffective(app, config);
  }

  private async mustFindApp(db: Db, appId: string): Promise<AppRow> {
    const numericId = Number(appId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    const app = await this.apps.findById(db, numericId);
    if (!app) {
      throw new NotFoundException("Aplikasi tidak ditemukan.");
    }
    return app;
  }

  private async mustFindConfig(
    db: Db,
    numericId: number,
  ): Promise<AppConfigRow> {
    const existing = await this.configs.findByAppId(db, numericId);
    if (existing) {
      return existing;
    }
    await this.configs.insertDefaultIfMissing(db, numericId);
    const created = await this.configs.findByAppId(db, numericId);
    if (!created) {
      throw new NotFoundException("Konfigurasi aplikasi tidak ditemukan.");
    }
    return created;
  }
}
