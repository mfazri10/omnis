import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { toNodeHandler } from "better-auth/node";
import type { Request, Response } from "express";
import { AppModule } from "./app.module";
import { AUTH } from "./auth/better-auth";
import type { Auth } from "./auth/better-auth";
import { createAuthRateLimit } from "./auth/rate-limit.middleware";
import { RedisService } from "./redis/redis.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable("x-powered-by");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3001";
  app.enableCors({
    origin: corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
  });

  // better-auth memakai satu mounted handler (bukan controller Nest),
  // sehingga rate limit dipasang sebagai middleware Express di sini.
  const redis = app.get(RedisService);
  // Getter lazy: klien Redis baru terhubung setelah app.init()/listen().
  app.use("/api/auth", createAuthRateLimit(() => redis.getClient()));
  const auth = app.get<Auth>(AUTH);
  const authHandler = toNodeHandler(auth);
  app.use("/api/auth", (req: Request, res: Response) =>
    authHandler(req, res),
  );

  const port = Number(process.env.API_PORT ?? 3000);
  // Di produksi API hanya diakses lewat reverse proxy lokal (Caddy).
  const host = process.env.API_HOST ?? "127.0.0.1";
  await app.listen(port, host);
}

void bootstrap();
