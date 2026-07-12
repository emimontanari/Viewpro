import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AppModule } from '../app.module'
import { API_BRAND } from './brand.constants'
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter'
import { requestIdMiddleware } from '../common/middleware/request-id.middleware'
import { SentryService } from '../observability/sentry.service'
import { getUploadsRoot } from '../property-engagements/property-images.storage'

export async function createApiApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const configService = app.get(ConfigService)
  const sentryService = app.get(SentryService)

  app.use(requestIdMiddleware)
  app.use(cookieParser())
  app.useStaticAssets(getUploadsRoot(), { prefix: '/uploads/' })
  app.setGlobalPrefix('api')
  const allowedOrigins = configService.getOrThrow<string[]>('app.cors.origins')
  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(null, false)
    },
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  app.useGlobalFilters(new GlobalExceptionFilter(configService.get<string>('app.nodeEnv'), sentryService))

  const swaggerConfig = new DocumentBuilder()
    .setTitle(API_BRAND.apiTitle)
    .setDescription(API_BRAND.apiDescription)
    .setVersion('0.1.0')
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, document)

  return app
}
