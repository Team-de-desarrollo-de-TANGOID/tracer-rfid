const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('racketClub', {
  appName: 'RFID TRACER — Trazabilidad y gestión de activos con RFID',
  vendor: 'TANGOID SRL',
  isElectron: true,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
});
