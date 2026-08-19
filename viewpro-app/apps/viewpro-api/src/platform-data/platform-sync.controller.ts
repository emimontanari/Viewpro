import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformPermissionGuard } from '../permissions/platform-permission.guard'
import { PLATFORM_PERMISSIONS } from '../permissions/platform-permissions.constants'
import { RequirePlatformPermission } from '../permissions/require-platform-permission.decorator'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformSyncCoordinator } from './platform-sync-coordinator'
import type { PlatformSyncStatus } from './platform-sync-coordinator'

/** Backend demand race budget (design.md). Never cancels admitted work on timeout. */
export const DEMAND_RACE_TIMEOUT_MS = 4000

/**
 * Races an already-started/joined coordinator run against a fixed timeout.
 * A settled run (success or mapped failure) passes through untouched; a
 * timed-out race falls back to the synchronous snapshot while the run keeps
 * executing uncancelled. Pure aside from `snapshot`, so it is testable
 * without guards, HTTP, or a database.
 */
export function raceDemand(
  run: Promise<PlatformSyncStatus>,
  snapshot: () => PlatformSyncStatus,
  timeoutMs: number = DEMAND_RACE_TIMEOUT_MS,
): Promise<PlatformSyncStatus> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs) })
  // Promise.race never cancels the losing side — `run` keeps executing.
  return Promise.race([run, timeout]).then((result) => {
    clearTimeout(timer)
    return result === 'timeout' ? snapshot() : result
  })
}

/**
 * PlatformSyncController — authenticated demand endpoint (Slice B, #327).
 * Starts/joins the shared coordinator promise and races it; 401/403 start
 * no demand. Since Slice D (#327) retired the unconditional poll job, this
 * is the sole entry point that starts synchronization work — idle is quiet.
 */
@Controller('operators/platform-sync')
@UseGuards(AuthGuard, PlatformPermissionGuard)
export class PlatformSyncController {
  constructor(private readonly coordinator: PlatformSyncCoordinator) {}

  @Post('demand')
  @HttpCode(200)
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.METRICS_READ)
  async demand(): Promise<PlatformSyncStatus> {
    return raceDemand(this.coordinator.runOneBatch(), () => this.coordinator.getStatus())
  }
}
