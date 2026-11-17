import { Module } from "@nestjs/common";
import { StorageModule } from "../../../storage/storage.module";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppsModule } from "../apps/apps.module";
import { MediaRepository } from "./media.repository";
import { MediaResolver } from "./media.resolver";
import { MediaService } from "./media.service";
import { MediaUploadController } from "./media-upload.controller";

@Module({
  // Guard konteks butuh AppsRepository; guard auth/permission global (F05).
  imports: [ActivityLogsModule, AppsModule, StorageModule],
  providers: [MediaRepository, MediaService, MediaResolver],
  controllers: [MediaUploadController],
})
export class MediaModule {}
