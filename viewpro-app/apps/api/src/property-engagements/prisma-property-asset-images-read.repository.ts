import { Inject, Injectable } from "@nestjs/common";
import type { PropertyAssetImage } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { PropertyAssetImagesReadRepository } from "./property-asset-images-read.repository";

@Injectable()
export class PrismaPropertyAssetImagesReadRepository
  implements PropertyAssetImagesReadRepository
{
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async findManyByAssetIds(
    assetIds: readonly string[],
  ): Promise<Map<string, PropertyAssetImage[]>> {
    if (assetIds.length === 0) {
      return new Map();
    }

    const images = await this.prisma.propertyAssetImage.findMany({
      where: { propertyAssetId: { in: [...assetIds] } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    const grouped = new Map<string, PropertyAssetImage[]>();
    for (const image of images) {
      const existing = grouped.get(image.propertyAssetId);
      if (existing) {
        existing.push(image);
      } else {
        grouped.set(image.propertyAssetId, [image]);
      }
    }

    return grouped;
  }
}
