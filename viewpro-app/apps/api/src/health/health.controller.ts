import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger'
import { PrismaService } from '../database/prisma.service'

type HealthResponse = {
  status: 'ok'
  service: 'viewpro-api'
  version: string
  uptime: number
  timestamp: string
}

type ReadinessResponse = {
  status: 'ok'
  service: 'viewpro-api'
  dependency: 'database'
  timestamp: string
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness — is the process up. Fast, no dependencies. Used by the container
  // HEALTHCHECK: a failure here means restart, so it must NOT depend on the DB.
  @Get()
  @ApiOkResponse({ description: 'Liveness — the process is up' })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'viewpro-api',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }

  // Readiness — can the service handle traffic. Verifies DB connectivity so a
  // load balancer / orchestrator probe can stop routing when the DB is down.
  @Get('ready')
  @ApiOkResponse({ description: 'Readiness — database reachable' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unavailable' })
  async getReadiness(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'viewpro-api',
        dependency: 'database',
      })
    }

    return {
      status: 'ok',
      service: 'viewpro-api',
      dependency: 'database',
      timestamp: new Date().toISOString(),
    }
  }
}
