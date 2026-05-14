import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'

type HealthResponse = {
  status: 'ok'
  service: 'viewpro-api'
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
    }
  }
}
