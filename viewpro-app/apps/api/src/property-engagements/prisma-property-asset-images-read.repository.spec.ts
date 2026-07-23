import { describe, expect, it, vi } from "vitest";
import type { PropertyAssetImage } from "@prisma/client";
import { PrismaPropertyAssetImagesReadRepository } from "./prisma-property-asset-images-read.repository";

/**
 * operator-activity-media (Slice 1) — RED: PrismaPropertyAssetImagesReadRepository
 *
 * Spec: activity-feed-property-images — "Batched Image URL Resolution" (no
 *   per-item storage/DB lookups for a full feed page).
 * Design D2: one `propertyAssetImage.findMany({ where: { propertyAssetId: {
 *   in: uniqueAssetIds } }, orderBy: [{isPrimary:'desc'},{createdAt:'asc'}] })`
 *   per page, grouped into a `Map<propertyAssetId, PropertyAssetImage[]>`.
 */

function makeImage(overrides: Partial<PropertyAssetImage>): PropertyAssetImage {
  return {
    id: "image-1",
    propertyAssetId: "asset-1",
    uploadedByUserId: "user-1",
    storageKey: "property-images/tenant-1/asset-1/image-1.jpg",
    originalFilename: "photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    isPrimary: false,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("PrismaPropertyAssetImagesReadRepository.findManyByAssetIds", () => {
  it("issues a SINGLE findMany call and groups results by propertyAssetId across multiple assets", async () => {
    const asset1Image = makeImage({ id: "img-1", propertyAssetId: "asset-1" });
    const asset2ImageA = makeImage({ id: "img-2", propertyAssetId: "asset-2", isPrimary: true });
    const asset2ImageB = makeImage({ id: "img-3", propertyAssetId: "asset-2" });
    const findMany = vi
      .fn()
      .mockResolvedValue([asset2ImageA, asset2ImageB, asset1Image]);
    const repo = new PrismaPropertyAssetImagesReadRepository({
      propertyAssetImage: { findMany },
    } as never);

    const result = await repo.findManyByAssetIds(["asset-1", "asset-2"]);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { propertyAssetId: { in: ["asset-1", "asset-2"] } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    expect(result.get("asset-1")).toEqual([asset1Image]);
    expect(result.get("asset-2")).toEqual([asset2ImageA, asset2ImageB]);
  });

  it("returns an empty array entry-less Map for an asset id with zero images (no throw, no omission at call site)", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaPropertyAssetImagesReadRepository({
      propertyAssetImage: { findMany },
    } as never);

    const result = await repo.findManyByAssetIds(["asset-with-no-images"]);

    expect(result.get("asset-with-no-images")).toBeUndefined();
    expect(result.size).toBe(0);
  });

  it("does NOT call findMany when given an empty asset id list (short-circuit, still a single-query guarantee)", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaPropertyAssetImagesReadRepository({
      propertyAssetImage: { findMany },
    } as never);

    const result = await repo.findManyByAssetIds([]);

    expect(findMany).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });
});
