// preload.js - CommonJS version for Electron
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateLean: async (text, opts = { validate: true }) => {
    try {
      if (typeof text !== 'string') {
        throw new Error('Text must be a string');
      }
      return await ipcRenderer.invoke('generate-lean', text, opts);
    } catch (error) {
      console.error('Preload error in generateLean:', error);
      return { ok: false, error: error.message };
    }
  },

  saveContent: async (content) => {
    return await ipcRenderer.invoke('save-content', content);
  },

  exportLeanFile: async (filepath, content) => {
    return await ipcRenderer.invoke('export-lean-file', filepath, content);
  },

  getTheme: async () => {
    return await ipcRenderer.invoke('get-theme');
  },

  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (event, action) => callback(action));
  },

  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (event, data) => callback(data));
  },

  onRequestContentForSave: (callback) => {
    ipcRenderer.on('request-content-for-save', () => callback());
  },

  onExportPDF: (callback) => {
    ipcRenderer.on('export-pdf', (event, filepath) => callback(filepath));
  },

  onExportLean: (callback) => {
    ipcRenderer.on('export-lean', (event, filepath) => callback(filepath));
  },

  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, isDark) => callback(isDark));
  }
});