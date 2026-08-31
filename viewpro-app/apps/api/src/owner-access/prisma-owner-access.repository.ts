import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { activeOwnerAccess } from './active-owner-access'
import type { OwnerAccessRepository } from './owner-access.repository'

@Injectable()
export class PrismaOwnerAccessRepository implements OwnerAccessRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async hasActiveOwnerAccess(userId: string): Promise<boolean> {
    // `take: 1` because the answer is a boolean: counting every property an
    // owner holds to decide whether they hold one is work nobody reads.
    const count = await this.prisma.propertyAsset.count({
      where: activeOwnerAccess(userId),
      take: 1,
    })

    return count > 0
  }
}
