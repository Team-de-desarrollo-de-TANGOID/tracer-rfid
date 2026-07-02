#!/usr/bin/env node
/**
 * Libera puertos locales sin depender de binarios externos (Windows / Unix).
 * Uso: node scripts/free-ports.mjs 3847 5173
 */
import { execSync } from 'child_process';

const ports = process.argv.slice(2).map(Number).filter((p) => p > 0);

function killPortWin(port) {
  try {
    const result = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const pids = new Set();
    for (const line of result.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!/LISTENING|LISTEN/i.test(trimmed)) continue;
      const parts = trimmed.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } catch {
        /* proceso ya terminado */
      }
    }
  } catch {
    /* puerto libre */
  }
}

function killPortUnix(port) {
  try {
    const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8' });
    for (const pid of result.trim().split('\n').filter(Boolean)) {
      try {
        process.kill(Number(pid), 'SIGTERM');
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* puerto libre */
  }
}

for (const port of ports) {
  if (process.platform === 'win32') killPortWin(port);
  else killPortUnix(port);
}
