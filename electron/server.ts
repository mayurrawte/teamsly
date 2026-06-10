import { app } from 'electron';
import { fork, type ChildProcess } from 'child_process';
import { createServer } from 'net';
import http from 'http';
import path from 'path';

export interface LocalServer {
  baseUrl: string;
  port: number;
  stop: () => void;
}

// In a packaged app, extraResources land under process.resourcesPath. The
// standalone server entry is server.js at the root of the copied standalone dir.
function standaloneEntry(): string {
  return path.join(process.resourcesPath, 'standalone', 'server.js');
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function healthCheck(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(baseUrl, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('local server health-check timed out'));
        else setTimeout(tick, 150);
      });
    };
    tick();
  });
}

/**
 * Spawn the bundled Next standalone server on a free loopback port using
 * Electron's own Node (ELECTRON_RUN_AS_NODE), then wait until it responds.
 * `env` carries NEXTAUTH/AUTH_SECRET/Azure/BYO values.
 */
export async function startLocalServer(env: Record<string, string>): Promise<LocalServer> {
  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  const entry = standaloneEntry();

  const child: ChildProcess = fork(entry, [], {
    cwd: path.dirname(entry),
    env: {
      ...process.env,
      ...env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NEXTAUTH_URL: baseUrl,
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });

  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[local-server] exited with code ${code}`);
  });

  await healthCheck(baseUrl, 20_000);

  const stop = () => {
    try { child.kill(); } catch { /* already gone */ }
  };
  app.on('before-quit', stop);
  return { baseUrl, port, stop };
}
