import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';

const root = new URL('../../..', import.meta.url).pathname;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function run(command, args, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root });
    let output = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref();
    }, timeoutMs);
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      code === 0 ? resolve(output) : reject(new Error(`${command} ${args.join(' ')} failed: ${output}`));
    });
  });
}

async function port() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}

export async function waitForReady(url, { deadlineMs = 60_000, intervalMs = 250, isRunning, now = Date.now, request = fetch, sleep = delay } = {}) {
  const deadline = now() + deadlineMs;
  let remaining = deadlineMs;
  while (remaining > 0) {
    if (!(await isRunning())) throw new Error('standalone server exited before readiness');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remaining);
    try {
      if ((await request(url, { redirect: 'manual', signal: controller.signal })).status === 200) return;
    } catch {}
    finally {
      clearTimeout(timeout);
    }
    await sleep(Math.min(intervalMs, remaining));
    remaining = deadline - now();
  }
  throw new Error(`timed out waiting for ${url}`);
}

export async function stopContainer(container, runCommand = run) {
  try {
    await runCommand('docker', ['stop', '-t', '5', container]);
  } catch {
    await runCommand('docker', ['kill', container]);
  }
  await runCommand('docker', ['wait', container]);
  await runCommand('docker', ['rm', container]);
}

export async function cleanup(container, label, runCommand = run) {
  const failures = [];
  const attempt = async (args) => {
    try {
      return await runCommand('docker', args);
    } catch (error) {
      failures.push(error);
      return '';
    }
  };
  if (container) await attempt(['rm', '-f', container]);
  const containers = await attempt(['ps', '-aq', '--filter', `label=${label}`]);
  await Promise.all(containers.trim().split(/\s+/).filter(Boolean).map((id) => attempt(['rm', '-f', id])));
  const images = await attempt(['images', '-q', '--filter', `label=${label}`]);
  await Promise.all(images.trim().split(/\s+/).filter(Boolean).map((id) => attempt(['rmi', '-f', id])));
  if (failures.length) throw new AggregateError(failures, 'runtime smoke cleanup failed');
}

export async function runImageSmoke(token, runCommand = run) {
  const label = `io.viewpro.sdd-attempt=${token}`;
  const image = `viewpro-app-runtime-smoke-${process.pid}`;
  let container;
  try {
    const [appPort, markerPort] = await Promise.all([port(), port()]);
    await runCommand('docker', ['build', '--label', label, '-f', 'apps/app-new/Dockerfile', '-t', image, '.']);
    await runCommand('docker', ['run', '--rm', '--entrypoint', 'sh', image, '-c', 'test -f apps/app-new/server.js && test -d apps/app-new/.next']);
    container = (await runCommand('docker', ['run', '-d', '--name', `${image}-container`, '--label', label, '-e', `PORT=${appPort}`, '-e', `VIEWPRO_RUNTIME_MARKER_PORT=${markerPort}`, '-p', `127.0.0.1:${appPort}:${appPort}`, image])).trim();
    await waitForReady(`http://127.0.0.1:${appPort}/auth/sign-in`, {
      isRunning: async () => (await runCommand('docker', ['inspect', '-f', '{{.State.Running}}', container])).trim() === 'true'
    });
    const marker = await runCommand('docker', ['exec', container, 'node', '-e', "require('node:http').get('http://127.0.0.1:" + markerPort + "/runtime-contract',r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>process.stdout.write(r.statusCode+'\\n'+r.headers['content-type']+'\\n'+b))}).on('error',e=>{throw e})"]);
    if (marker !== '200\ntext/plain\nviewpro-contract-runtime:not-generated-yet\n') throw new Error(`unexpected marker: ${marker}`);
    await stopContainer(container, runCommand);
    container = undefined;
  } finally {
    await cleanup(container, label, runCommand);
  }
}

async function main() {
  const token = process.env.VIEWPRO_RUNTIME_SMOKE_TOKEN;
  if (!/^sha256:[a-f0-9]{64}$/.test(token ?? '')) throw new Error('VIEWPRO_RUNTIME_SMOKE_TOKEN must be the acquired attempt token');
  await runImageSmoke(token);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
