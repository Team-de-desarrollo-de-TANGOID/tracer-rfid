import http from 'http';
import { getFx9600Config } from './fx9600Service.js';
import { subscribeSshLogStreamPassword } from './fx9600Ssh.js';

const LOG_PATH = '/tmp/racketclub-gate.log';

function parseSseChunk(part, onEvent) {
  if (!part.trim()) return;
  let event = 'message';
  let data = '';
  for (const line of part.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return;
  try {
    onEvent(event, JSON.parse(data));
  } catch {
    onEvent(event, { lines: data });
  }
}

function attachSseHttpResponse(res, onEvent) {
  let buffer = '';
  res.on('data', (chunk) => {
    buffer += chunk.toString('utf-8');
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) parseSseChunk(part, onEvent);
  });
}

export function subscribeUserAppLogStream({ tail = 150, onEvent, onError, signal } = {}) {
  const cfg = getFx9600Config();

  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: cfg.ip,
        port: cfg.appPort,
        path: `/api/logs/stream?tail=${tail}`,
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(cfg.appToken ? { 'X-RacketClub-Token': cfg.appToken } : {}),
        },
        timeout: 0,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          onError?.(`User App log stream HTTP ${res.statusCode}`);
          resolve({ ok: false, source: 'user-app' });
          return;
        }

        attachSseHttpResponse(res, onEvent);
        res.on('end', () => onError?.('Stream de logs finalizado'));
        res.on('error', (e) => onError?.(e.message));

        resolve({
          ok: true,
          source: 'user-app',
          streaming: true,
          close: () => req.destroy(),
        });
      }
    );

    req.on('error', (e) => {
      onError?.(e.message);
      resolve({ ok: false, source: 'user-app', error: e.message });
    });

    const onAbort = () => req.destroy();
    signal?.addEventListener('abort', onAbort);

    req.setTimeout(8000, () => {
      req.destroy(new Error('Timeout al abrir stream de logs'));
    });

    req.end();
  });
}

/** User App stream; si falla y hay credenciales SSH en sesión, tail -f por SSH. */
export async function pipeReaderLogs({ onEvent, onError, signal, tail = 150, sshAuth } = {}) {
  const userApp = await subscribeUserAppLogStream({ tail, onEvent, onError, signal });
  if (userApp.ok) return userApp;

  if (!sshAuth?.sshPassword) {
    onError?.('No se pudo abrir el stream de la User App. Verifique credenciales SSH.');
    return { ok: false };
  }

  onEvent?.('meta', {
    source: 'ssh-fallback',
    message: 'User App sin stream — conectando por SSH (tail -f)…',
  });

  return subscribeSshLogStreamPassword({
    tail,
    sshUser: sshAuth.sshUser,
    sshPassword: sshAuth.sshPassword,
    ip: sshAuth.ip,
    onEvent,
    onError,
    signal,
  });
}
