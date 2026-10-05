import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const adminDir = dirname(fileURLToPath(import.meta.url));

function runServer() {
  console.log('[DevRunner] Starting TokenTrim Admin on port 3100...');
  const child = spawn(
    'npx',
    ['next', 'dev', '--port', '3100'],
    {
      cwd: adminDir,
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: true,
      env: {
        ...process.env,
        CI: 'true',
        NEXT_TELEMETRY_DISABLED: '1'
      }
    }
  );

  child.on('exit', (code, signal) => {
    console.log(`[DevRunner] Next.js process exited (code=${code}, signal=${signal}). Restarting in 1.5s...`);
    setTimeout(runServer, 1500);
  });

  child.on('error', (err) => {
    console.error('[DevRunner] Child process error:', err);
  });
}

// Keep event loop alive
setInterval(() => {}, 1000 * 60 * 60);

runServer();
