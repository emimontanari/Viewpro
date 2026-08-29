import { createServer, type Server } from 'node:http';
import { apiContractStatus } from '@viewpro/contracts';

const MARKER_PATH = '/runtime-contract';

export function startRuntimeContractMarker(portValue: string): Promise<Server> {
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('VIEWPRO_RUNTIME_MARKER_PORT must be an integer between 0 and 65535');
  }

  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== MARKER_PATH) {
      response.statusCode = 404;
      response.end();
      return;
    }

    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end(`viewpro-contract-runtime:${apiContractStatus}\n`);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port }, () => {
      server.removeAllListeners('error');
      server.unref();
      resolve(server);
    });
  });
}
