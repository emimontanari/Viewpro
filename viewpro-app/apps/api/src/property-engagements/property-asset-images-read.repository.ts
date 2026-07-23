import type { PropertyAssetImage } from "@prisma/client";

export const PROPERTY_ASSET_IMAGES_READ_REPOSITORY = Symbol(
  "PROPERTY_ASSET_IMAGES_READ_REPOSITORY",
);

/**
 * PropertyAssetImagesReadRepository — batched, read-only lookup of
 * `PropertyAssetImage` rows for a set of property asset ids.
 *
 * operator-activity-media (Slice 1) design D2: exists SOLELY to satisfy the
 * activity feed's "no N+1" requirement — a single `findMany` per page,
 * grouped by `propertyAssetId`. Absent asset ids are simply not present as
 * keys in the returned Map (never an error, never a synthesized empty
 * array) — callers must treat a missing key the same as "zero images".
 */
export type PropertyAssetImagesReadRepository = {
  findManyByAssetIds(
    assetIds: readonly string[],
  ): Promise<Map<string, PropertyAssetImage[]>>;
};
