// Copyright 2025 Beast
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// main.js - Electron main process with menu bar
import { app, BrowserWindow, ipcMain, Menu, dialog, nativeTheme } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { tokenizeSentences } from './nlp/tokenizer.js';
import { extractEntities } from './nlp/entities.js';
import { buildProofTree } from './nlp/proofTree.js';
import { generateLean } from './lean/generator.js';
import { validateLean } from './lean/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let currentFilePath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Proof Chat Editor'
  });

  mainWindow.loadFile('index.html');
  
  // Create menu
  createMenu();

  // Handle theme changes
  nativeTheme.on('updated', () => {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
  });

  mainWindow.on('close', (e) => {
    // Could add unsaved changes check here
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-action', 'new');
          }
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpen()
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => handleSave()
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => handleSaveAs()
        },
        { type: 'separator' },
        {
          label: 'Export to PDF',
          accelerator: 'CmdOrCtrl+E',
          click: () => handleExportPDF()
        },
        {
          label: 'Export Lean Code',
          click: () => handleExportLean()
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Clear History',
          click: () => {
            mainWindow.webContents.send('menu-action', 'clear-history');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Dark Mode',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            mainWindow.webContents.send('menu-action', 'toggle-theme');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu-action', 'preferences');
          }
        },
        { type: 'separator' },
        {
          label: 'Lean Path',
          click: () => {
            mainWindow.webContents.send('menu-action', 'lean-path');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            mainWindow.webContents.send('menu-action', 'documentation');
          }
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => {
            mainWindow.webContents.send('menu-action', 'shortcuts');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            mainWindow.webContents.send('menu-action', 'about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function handleOpen() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Proof Files', extensions: ['proof', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filepath = result.filePaths[0];
    try {
      const content = await fs.promises.readFile(filepath, 'utf8');
      currentFilePath = filepath;
      mainWindow.webContents.send('file-opened', { filepath, content });
    } catch (err) {
      dialog.showErrorBox('Error', `Failed to open file: ${err.message}`);
    }
  }
}

async function handleSave() {
  if (currentFilePath) {
    await saveToFile(currentFilePath);
  } else {
    await handleSaveAs();
  }
}

async function handleSaveAs() {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Proof Files', extensions: ['proof'] },
      { name: 'Text Files', extensions: ['txt'] }
    ],
    defaultPath: 'untitled.proof'
  });

  if (!result.canceled && result.filePath) {
    currentFilePath = result.filePath;
    await saveToFile(result.filePath);
  }
}

async function saveToFile(filepath) {
  try {
    mainWindow.webContents.send('request-content-for-save');
  } catch (err) {
    dialog.showErrorBox('Error', `Failed to save file: ${err.message}`);
  }
}

async function handleExportPDF() {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    defaultPath: 'proof.pdf'
  });

  if (!result.canceled && result.filePath) {
    mainWindow.webContents.send('export-pdf', result.filePath);
  }
}

async function handleExportLean() {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Lean Files', extensions: ['lean'] }],
    defaultPath: 'proof.lean'
  });

  if (!result.canceled && result.filePath) {
    mainWindow.webContents.send('export-lean', result.filePath);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC handlers
ipcMain.handle('generate-lean', async (event, englishText, opts = { validate: true }) => {
  try {
    if (!englishText || typeof englishText !== 'string') {
      return { ok: false, error: 'Invalid input: englishText must be a non-empty string' };
    }

    const sentences = tokenizeSentences(englishText);
    const entities = extractEntities(sentences);
    const proofTree = buildProofTree(sentences, entities);
    const leanCode = generateLean(proofTree);

    if (!leanCode) {
      return { ok: false, error: 'Failed to generate Lean code' };
    }

    let validation = null;
    if (opts.validate) {
      try {
        validation = await validateLean(leanCode);
      } catch (err) {
        validation = { ok: false, error: String(err) };
      }
    }

    return { ok: true, lean: leanCode, proofTree, validation };
  } catch (err) {
    console.error('Error in generate-lean:', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('save-content', async (event, content) => {
  if (currentFilePath) {
    try {
      await fs.promises.writeFile(currentFilePath, content, 'utf8');
      return { ok: true, filepath: currentFilePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  return { ok: false, error: 'No file path set' };
});

ipcMain.handle('export-lean-file', async (event, filepath, content) => {
  try {
    await fs.promises.writeFile(filepath, content, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-theme', async () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});