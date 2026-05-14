import { ConfigService } from '@nestjs/config'
import { createApiApp } from './bootstrap/create-app'

async function bootstrap() {
  const app = await createApiApp()
  const configService = app.get(ConfigService)
  const port = configService.get<number>('app.port') ?? 3001

  await app.listen(port)
}

void bootstrap()
