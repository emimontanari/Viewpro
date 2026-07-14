import { Controller, Get, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { MetricsService } from './metrics.service'
import type { MetricsSummary } from './metrics.service'

/**
 * MetricsController — operator-facing metrics endpoint.
 *
 * Protected by Phase 4 AuthGuard (viewpro_platform_access_token cookie).
 * Serves data EXCLUSIVELY from the viewpro_platform mirror — never from InmoView.
 */
@Controller('operators/metrics')
@UseGuards(AuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * GET /operators/metrics/summary
   *
   * Returns the operator metrics summary derived from the platform mirror.
   * Uses latest-event-wins per tenant (D6 — DISTINCT ON tenantId ORDER BY seqNo DESC).
   */
  @Get('summary')
  async getSummary(): Promise<MetricsSummary> {
    return this.metricsService.getSummary()
  }
}
