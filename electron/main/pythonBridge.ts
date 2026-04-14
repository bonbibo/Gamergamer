import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';

const PYTHON_PORT = 8765;
const HEALTH_URL = `http://localhost:${PYTHON_PORT}/health`;
const MAX_RETRIES = 20;
const RETRY_INTERVAL_MS = 1000;

let pythonProcess: ChildProcess | null = null;

function getPythonCommand(): { cmd: string; args: string[]; cwd: string } {
  const isProd = app.isPackaged;
  if (isProd) {
    const execPath = path.join(process.resourcesPath, 'python-service', 'gamergamer-service');
    return { cmd: execPath, args: [], cwd: process.resourcesPath };
  }
  // Development: run via uvicorn from project root
  const projectRoot = path.join(__dirname, '..', '..', '..');
  return {
    cmd: process.platform === 'win32' ? 'python' : 'python3',
    args: ['-m', 'uvicorn', 'python.main:app', '--host', '0.0.0.0', '--port', String(PYTHON_PORT)],
    cwd: projectRoot,
  };
}

export async function startPythonService(): Promise<void> {
  const { cmd, args, cwd } = getPythonCommand();

  // Data directory: use app userData so it survives updates and isn't inside bundle
  const dataDir = path.join(app.getPath('userData'), 'data');

  pythonProcess = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GAMERGAMER_DATA_DIR: dataDir },
  });

  pythonProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[Python]', data.toString().trim());
  });
  pythonProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[Python ERR]', data.toString().trim());
  });
  pythonProcess.on('exit', (code) => {
    console.log(`[Python] Process exited with code ${code}`);
    pythonProcess = null;
  });

  await waitForHealthy();
}

export function stopPythonService(): void {
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
}

async function waitForHealthy(): Promise<void> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) {
        console.log('[Python] Service is healthy.');
        return;
      }
    } catch {
      // not ready yet
    }
    await sleep(RETRY_INTERVAL_MS);
  }
  throw new Error('Python service did not become healthy in time.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
