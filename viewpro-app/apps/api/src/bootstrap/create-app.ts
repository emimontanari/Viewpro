import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import { AppModule } from '../app.module'
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter'
import { requestIdMiddleware } from '../common/middleware/request-id.middleware'

export async function createApiApp() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  app.use(requestIdMiddleware)
  app.use(cookieParser())
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
  app.useGlobalFilters(new GlobalExceptionFilter(configService.get<string>('app.nodeEnv')))

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ViewPro API')
    .setDescription('REST API for ViewPro')
    .setVersion('0.1.0')
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, document)

  return app
}
