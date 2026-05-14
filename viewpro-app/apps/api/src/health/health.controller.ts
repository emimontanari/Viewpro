import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

type HealthResponse = {
  status: 'ok'
  service: 'viewpro-api'
  version: string
  uptime: number
  timestamp: string
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'API health status' })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'viewpro-api',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }
}
