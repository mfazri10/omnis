import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/**
 * Deklarasi permission yang dibutuhkan operasi; dibaca PermissionGuard.
 * Semua kunci harus dipenuhi (AND).
 */
export const RequirePermissions = (
  ...permissions: string[]
): ReturnType<typeof SetMetadata> =>
  SetMetadata(PERMISSIONS_KEY, permissions);
