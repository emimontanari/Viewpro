import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AppModule } from '../app.module'
import { SentryExceptionFilter } from '../common/filters/sentry-exception.filter'
import { requestIdMiddleware } from '../common/middleware/request-id.middleware'
import { SentryService } from '../observability/sentry.service'
import { PLATFORM_BRAND } from './brand.constants'

export async function createPlatformApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const configService = app.get(ConfigService)
  const sentryService = app.get(SentryService)

  // trust proxy: 1 — adjust for your topology if using multiple proxies.
  // With a single reverse proxy (Dokploy/Nginx/Caddy), '1' tells Express to
  // trust the first X-Forwarded-For hop as the real client IP, which is
  // required for AuthThrottlerGuard to see the correct IP.
  app.set('trust proxy', 1)

  app.use(requestIdMiddleware)
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

  app.useGlobalFilters(
    new SentryExceptionFilter(
      app.get(HttpAdapterHost).httpAdapter,
      sentryService,
    ),
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
