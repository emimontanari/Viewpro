import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { startRuntimeContractMarker } from './instrumentation-node';

const originalEnvironment = { ...process.env };
type ModuleFactory = () => Record<string, unknown>;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  process.env = { ...originalEnvironment };
});

async function importInstrumentation(
  marker: ReturnType<typeof vi.fn>,
  factories: {
    contractFactory?: ModuleFactory;
    helperFactory?: ModuleFactory;
  } = {}
) {
  vi.doMock('./instrumentation-node', factories.helperFactory ?? (() => ({ startRuntimeContractMarker: marker })));
  if (factories.contractFactory) vi.doMock('@viewpro/contracts', factories.contractFactory);
  return import('./instrumentation');
}

describe('runtime contract instrumentation', () => {
  it('starts the Node-only marker independently of Sentry with the shared contract status', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    process.env.VIEWPRO_RUNTIME_MARKER_PORT = '43123';
    const marker = vi.fn().mockResolvedValue(undefined);
    const { register } = await importInstrumentation(marker);

    await register();

    expect(marker).toHaveBeenCalledWith('43123');
  });

  it('does not evaluate the contract or Node-helper module factory under Edge', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    process.env.VIEWPRO_RUNTIME_MARKER_PORT = '43123';
    const marker = vi.fn().mockResolvedValue(undefined);
    const helperFactory = vi.fn(() => ({ startRuntimeContractMarker: marker }));
    const contractFactory = vi.fn(() => ({ apiContractStatus: 'not-generated-yet' }));
    const { register } = await importInstrumentation(marker, { contractFactory, helperFactory });

    await register();

    expect(contractFactory).not.toHaveBeenCalled();
    expect(helperFactory).not.toHaveBeenCalled();
    expect(marker).not.toHaveBeenCalled();
  });

  it('does not import the marker helper when the marker port is absent', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    const marker = vi.fn().mockResolvedValue(undefined);
    const { register } = await importInstrumentation(marker);

    await register();

    expect(marker).not.toHaveBeenCalled();
  });

  it('serves only the exact loopback marker response', async () => {
    const server = await startRuntimeContractMarker('0');
    const port = (server.address() as { port: number }).port;

    try {
      const [response, rejected] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/runtime-contract`),
        fetch(`http://127.0.0.1:${port}/runtime-contract`, { method: 'POST' })
      ]);

      expect([response.status, response.headers.get('content-type'), await response.text()]).toEqual([
        200,
        'text/plain',
        'viewpro-contract-runtime:not-generated-yet\n'
      ]);
      expect([rejected.status, await rejected.text()]).toEqual([404, '']);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('propagates EADDRINUSE instead of reporting a false marker start', async () => {
    const occupied = createServer();
    await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
    const port = (occupied.address() as { port: number }).port;

    try {
      await expect(startRuntimeContractMarker(String(port))).rejects.toMatchObject({
        code: 'EADDRINUSE'
      });
    } finally {
      await new Promise<void>((resolve) => occupied.close(() => resolve()));
    }
  });
});
