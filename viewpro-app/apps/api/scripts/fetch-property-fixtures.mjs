#!/usr/bin/env node
// One-time script that downloads property images from the Zonaprop source JSON
// into local fixture files so the demo seed remains deterministic and offline.
//
// Run once to populate scripts/fixtures/properties/<postingId>/<order>.jpg.
// The demo seed reads these bytes via property-image-map.json.

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(scriptDir, 'fixtures');
const propertiesDir = join(fixturesDir, 'properties');
const sourcePath = join(fixturesDir, 'zonaprop-source.json');
const mapPath = join(fixturesDir, 'property-image-map.json');

async function main() {
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  const map = JSON.parse(await readFile(mapPath, 'utf8'));
  const imagesPerProperty = map.imagesPerProperty ?? 3;
  const wanted = new Set(map.mappings.map((m) => m.postingId));

  await mkdir(propertiesDir, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  for (const listing of source) {
    if (!wanted.has(listing.posting_id)) continue;
    const pictures = listing.visible_pictures?.pictures ?? [];
    const limit = Math.min(imagesPerProperty, pictures.length);
    for (let order = 0; order < limit; order += 1) {
      const url = pictures[order]?.url730x532;
      if (!url) continue;
      const targetDir = join(propertiesDir, listing.posting_id);
      await mkdir(targetDir, { recursive: true });
      const targetPath = join(targetDir, `${order}.jpg`);
      try {
        await stat(targetPath);
        skipped += 1;
        continue;
      } catch {
        // file does not exist, proceed
      }
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`skip ${listing.posting_id}#${order}: HTTP ${response.status}`);
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(targetPath, buffer);
      downloaded += 1;
      console.log(`saved ${listing.posting_id}#${order} (${buffer.byteLength} bytes)`);
    }
  }

  console.log(`done. downloaded=${downloaded} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
