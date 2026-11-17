import { SetMetadata } from "@nestjs/common";

export const APP_SCOPED_KEY = "appScoped";

/**
 * Menandai operasi app-scoped: AppContextGuard mewajibkan header
 * X-App-Slug tervalidasi. Operasi global (tanpa tanda) mengabaikan header.
 */
export const AppScoped = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(APP_SCOPED_KEY, true);
