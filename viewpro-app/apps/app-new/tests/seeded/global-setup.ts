import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const workspaceRoot = resolve(process.cwd(), '../..');

export default async function globalSetup() {
  execFileSync('pnpm', ['demo:seed'], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit'
  });
}
