import { spawn, ChildProcess, execSync } from 'child_process';
import net from 'net';

/** A disposable redis-server on a random port, so tests can simulate a Redis outage safely. */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export class TestRedis {
  private proc: ChildProcess | null = null;
  constructor(public readonly port: number) {}
  get url() { return `redis://127.0.0.1:${this.port}`; }

  async start() {
    this.proc = spawn('redis-server', ['--port', String(this.port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try { execSync(`redis-cli -p ${this.port} ping`, { stdio: 'pipe' }); return; } catch { await new Promise(r => setTimeout(r, 50)); }
    }
    throw new Error('redis-server did not start');
  }

  async stop() {
    if (!this.proc) return;
    const p = this.proc;
    this.proc = null;
    await new Promise<void>(r => { p.once('exit', () => r()); p.kill('SIGKILL'); });
  }
}
