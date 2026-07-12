import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const workspaceRoot = resolve(process.cwd(), '../..');
const apiPort = Number(process.env.VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT ?? 3001);
const host = '127.0.0.1';
const apiBaseUrl = `http://${host}:${apiPort}`;
const documentStorageRoot = resolve(workspaceRoot, 'apps/api/.document-storage-seeded');
const accessTokenSecret =
  process.env.VIEWPRO_APP_NEW_SEEDED_E2E_ACCESS_TOKEN_SECRET ?? 'app-new-seeded-auth-e2e-local';

export default async function globalSetup() {
  await rm(documentStorageRoot, { force: true, recursive: true });

  execFileSync('pnpm', ['demo:seed'], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      API_PUBLIC_URL: apiBaseUrl,
      DOCUMENT_STORAGE_DRIVER: 'local',
      DOCUMENT_STORAGE_LOCAL_ROOT: documentStorageRoot,
      DOCUMENT_STORAGE_SIGNING_SECRET: accessTokenSecret
    },
    stdio: 'inherit'
  });
}
