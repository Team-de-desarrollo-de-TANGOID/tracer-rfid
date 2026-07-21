import { Client } from 'ssh2';
import { getFx9600Config } from './fx9600Service.js';

function sshConnect({ host, username, password, readyTimeout = 20000 }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect({
      host,
      username,
      password,
      readyTimeout,
      tryKeyboard: false,
    });
  });
}

export async function sshExecWithPassword(command, { sshUser, sshPassword, ip } = {}) {
  const cfg = getFx9600Config();
  const host = ip || cfg.ip;
  const username = sshUser || cfg.sshUser || 'rfidadm';
  if (!sshPassword) {
    throw new Error('Contraseña SSH requerida');
  }

  const conn = await sshConnect({ host, username, password: sshPassword });
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        conn.end();
        reject(err);
        return;
      }
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => {
        stdout += d.toString();
      });
      stream.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      stream.on('close', (code) => {
        conn.end();
        if (code !== 0 && code != null && !stdout.trim() && !stderr.trim()) {
          reject(new Error(stderr.trim() || `SSH exit ${code}`));
          return;
        }
        resolve(stdout + stderr);
      });
    });
  });
}

export async function scpUploadWithPassword(localPath, remotePath, { sshUser, sshPassword, ip } = {}) {
  const cfg = getFx9600Config();
  const host = ip || cfg.ip;
  const username = sshUser || cfg.sshUser || 'rfidadm';
  if (!sshPassword) {
    throw new Error('Contraseña SSH requerida');
  }

  const conn = await sshConnect({ host, username, password: sshPassword });
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        reject(err);
        return;
      }
      sftp.fastPut(localPath, remotePath, (putErr) => {
        conn.end();
        if (putErr) reject(putErr);
        else resolve();
      });
    });
  });
}

/** tail -f por SSH con contraseña (stream de líneas). */
export function subscribeSshLogStreamPassword({
  tail = 150,
  sshUser,
  sshPassword,
  ip,
  onEvent,
  onError,
  signal,
}) {
  const cfg = getFx9600Config();
  const host = ip || cfg.ip;
  const username = sshUser || cfg.sshUser || 'rfidadm';
  const logPath = '/tmp/racketclub-gate.log';

  return new Promise((resolve) => {
    if (!sshPassword) {
      onError?.('Contraseña SSH requerida');
      resolve({ ok: false, source: 'ssh' });
      return;
    }

    const conn = new Client();
    let buffer = '';

    const flush = () => {
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      const lines = parts.filter((l) => l.trim());
      if (lines.length) onEvent?.('log', { lines: lines.join('\n'), source: 'ssh' });
    };

    const cleanup = () => {
      try {
        conn.end();
      } catch {
        /* ignore */
      }
    };

    signal?.addEventListener('abort', cleanup);

    conn.on('ready', () => {
      onEvent?.('meta', {
        source: 'ssh',
        path: logPath,
        mode: `ssh ${username}@${host} · tail -f`,
      });
      conn.exec(`tail -n ${tail} -f ${logPath}`, (err, stream) => {
        if (err) {
          onError?.(err.message);
          cleanup();
          resolve({ ok: false, source: 'ssh', error: err.message });
          return;
        }
        stream.on('data', (d) => {
          buffer += d.toString('utf-8');
          flush();
        });
        stream.stderr.on('data', (d) => {
          const msg = d.toString().trim();
          if (msg) onError?.(msg);
        });
        stream.on('close', () => {
          onError?.('Sesión SSH de logs cerrada');
          cleanup();
        });
        resolve({ ok: true, source: 'ssh', streaming: true, close: cleanup });
      });
    });

    conn.on('error', (e) => {
      onError?.(e.message);
      resolve({ ok: false, source: 'ssh', error: e.message });
    });

    conn.connect({ host, username, password: sshPassword, readyTimeout: 20000 });
  });
}
