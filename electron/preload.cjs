const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('racketClub', {
  appName: 'RFID TRACER — Trazabilidad y gestión de activos con RFID',
  vendor: 'TANGOID SRL',
  isElectron: true,
});
