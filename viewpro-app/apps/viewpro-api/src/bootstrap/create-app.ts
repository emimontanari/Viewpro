import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AppModule } from '../app.module'
import { PLATFORM_BRAND } from './brand.constants'

export async function createPlatformApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const configService = app.get(ConfigService)

  // trust proxy: 1 — adjust for your topology if using multiple proxies.
  // With a single reverse proxy (Dokploy/Nginx/Caddy), '1' tells Express to
  // trust the first X-Forwarded-For hop as the real client IP, which is
  // required for AuthThrottlerGuard to see the correct IP.
  app.set('trust proxy', 1)

  app.use(cookieParser())
  app.setGlobalPrefix('api')

  const corsOrigin = configService.get<string>('app.corsOrigin')
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : false,
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  const swaggerConfig = new DocumentBuilder()
    .setTitle(PLATFORM_BRAND.apiTitle)
    .setDescription(PLATFORM_BRAND.apiDescription)
    .setVersion('0.1.0')
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, document)

  return app
}
