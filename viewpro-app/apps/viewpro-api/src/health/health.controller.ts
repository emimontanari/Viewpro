import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

type HealthResponse = {
  status: 'ok'
  service: 'viewpro-platform-api'
  timestamp: string
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'Platform API health status' })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'viewpro-platform-api',
      timestamp: new Date().toISOString(),
    }
  }
}
