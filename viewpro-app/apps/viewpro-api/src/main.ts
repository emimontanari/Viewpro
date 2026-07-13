import 'reflect-metadata'

import { ConfigService } from '@nestjs/config'
import { createPlatformApp } from './bootstrap/create-app'

async function bootstrap() {
  const app = await createPlatformApp()
  const configService = app.get(ConfigService)
  const port = configService.get<number>('app.port') ?? 3002

  await app.listen(port)
}

void bootstrap()
