const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let serverProcess = null;
let serverStartedInProcess = false;
// FC_PACKAGED_MODE=1 prueba API+UI en un solo proceso (`npm run test:packaged`)
const usePackagedLayout = app.isPackaged;
const isDev =
  !usePackagedLayout && process.env.FC_PACKAGED_MODE !== '1';
const API_PORT = process.env.API_PORT || '3847';

function getDataDir() {
  if (!usePackagedLayout) {
    return path.join(__dirname, '..', 'data');
  }
  return path.join(path.dirname(process.execPath), 'data');
}

function getServerScript() {
  if (!usePackagedLayout) {
    return path.join(__dirname, '..', 'server', 'index.js');
  }
  // El servidor debe cargarse desde app.asar para resolver node_modules empaquetados.
  // Si estuviera en app.asar.unpacked, fallaría con "Cannot find package 'express'".
  return path.join(process.resourcesPath, 'app.asar', 'server', 'index.js');
}

function logError(message, err) {
  const line = `[${new Date().toISOString()}] ${message}${err ? `\n${err.stack || err}` : ''}\n`;
  console.error(line);
  try {
    const logDir = getDataDir();
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'racket-club.log'), line);
  } catch {
    /* ignore log write errors */
  }
}

function showFatalError(title, err) {
  const detail = err?.stack || err?.message || String(err);
  logError(title, err);
  dialog.showErrorBox(
    'RFID TRACER — Trazabilidad y gestión de activos con RFID',
    `${title}\n\n${detail}\n\nRevise data/racket-club.log junto al programa.`
  );
}

/** En el .exe empaquetado el servidor corre en el mismo proceso (evita spawn con rutas con espacios). */
async function startApiServerInProcess() {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  process.env.API_PORT = String(API_PORT);
  process.env.RC_DATA_DIR = dataDir;
  process.env.SERVE_UI = '1';
  if (usePackagedLayout) {
    const unpackedDist = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'dist'
    );
    const asarDist = path.join(process.resourcesPath, 'app.asar', 'dist');
    process.env.RC_DIST_DIR = fs.existsSync(unpackedDist) ? unpackedDist : asarDist;
  }

  const serverPath = getServerScript();
  if (!fs.existsSync(serverPath)) {
    throw new Error(`No se encontró el servidor en: ${serverPath}`);
  }

  await import(pathToFileURL(serverPath).href);
  serverStartedInProcess = true;
}

/** Solo desarrollo: proceso hijo con Node (usa execFile por rutas con espacios en Windows). */
function startApiServerChild() {
  const { execFile } = require('child_process');
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const serverPath = getServerScript();
  const nodeExec = process.execPath;

  serverProcess = execFile(
    nodeExec,
    [serverPath],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        API_PORT: String(API_PORT),
        RC_DATA_DIR: dataDir,
        ELECTRON_RUN_AS_NODE: '1',
        SERVE_UI: '0',
      },
      windowsHide: true,
    },
    (err) => {
      if (err) logError('Servidor hijo finalizado con error', err);
    }
  );

  serverProcess.on('error', (err) => logError('No se pudo iniciar el servidor hijo', err));
  if (serverProcess.stdout) serverProcess.stdout.on('data', (d) => console.log(String(d)));
  if (serverProcess.stderr) serverProcess.stderr.on('data', (d) => console.error(String(d)));
}

async function startApiServer() {
  if (isDev) {
    startApiServerChild();
    return;
  }
  await startApiServerInProcess();
}

function shouldRunServerInProcess() {
  return usePackagedLayout || process.env.FC_PACKAGED_MODE === '1';
}

async function waitForApi(timeoutMs = 30000) {
  const url = `http://127.0.0.1:${API_PORT}/api/health`;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(
    `La API no respondió en el puerto ${API_PORT}. Compruebe que ningún firewall bloquee localhost.`
  );
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Racket Club - Trazabilidad de activos',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadURL(`http://127.0.0.1:${API_PORT}`);
  }

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    logError(`Error al cargar la UI (${code})`, new Error(desc));
  });
}

app.whenReady().then(async () => {
  try {
    if (isDev) {
      if (process.env.ELECTRON_START_SERVER === '1') {
        startApiServerChild();
        await waitForApi();
      }
      await createWindow();
      return;
    }

    if (shouldRunServerInProcess()) {
      await startApiServerInProcess();
    } else {
      startApiServerChild();
    }
    await waitForApi();
    await createWindow();
  } catch (err) {
    showFatalError('No se pudo iniciar la aplicación.', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
