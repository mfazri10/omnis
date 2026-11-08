import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.client = new Redis(this.config.getOrThrow<string>("REDIS_URL"), {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await this.client.connect();
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }
}
