import { ForbiddenException, NotFoundException } from "@nestjs/common";

export class AppNotFoundException extends NotFoundException {
  constructor(slug: string) {
    super(`Aplikasi "${slug}" tidak ditemukan.`);
  }
}

export class AppSuspendedException extends ForbiddenException {
  constructor(slug: string, status: string) {
    super(`Aplikasi "${slug}" berstatus ${status}.`);
  }
}
