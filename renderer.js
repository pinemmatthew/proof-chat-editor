// renderer.js - Frontend with theme support and menu handling
const englishInput = document.getElementById('englishInput');
const leanOutput = document.getElementById('leanOutput');
const validationOutput = document.getElementById('validationOutput');
const historyDiv = document.getElementById('history');
const validateToggle = document.getElementById('validateToggle');
const statusIndicator = document.getElementById('statusIndicator');
const notification = document.getElementById('notification');
const themeToggle = document.getElementById('themeToggle');
const fileIndicator = document.getElementById('fileIndicator');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const copyLeanBtn = document.getElementById('copyLeanBtn');

let messages = [];
let debounceTimer = null;
let isGenerating = false;
let currentTheme = 'light';
let currentFilePath = null;

// Initialize
async function init() {
  try {
    currentTheme = await window.api.getTheme();
  } catch {
    currentTheme = 'light';
  }
  applyTheme(currentTheme);
  setupEventListeners();
  setupMenuHandlers();
  setupMathPalette();
  englishInput.focus();
}

function setupEventListeners() {
  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);

  // Clear history
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Copy Lean code
  copyLeanBtn.addEventListener('click', copyLeanCode);

  // Keyboard shortcuts
  englishInput.addEventListener('keydown', handleKeydown);
  englishInput.addEventListener('input', handleInput);

  // Validation toggle
  validateToggle.addEventListener('change', () => {
    if (messages.length > 0) {
      runPipeline();
    }
  });

  // Modal handlers
  setupModalHandlers();
}

function setupMenuHandlers() {
  // Listen for menu actions
  window.api.onMenuAction((action) => {
    handleMenuAction(action);
  });

  // File opened
  window.api.onFileOpened((data) => {
    loadFile(data);
  });

  // Save request
  window.api.onRequestContentForSave(() => {
    saveContent();
  });

  // Export handlers
  window.api.onExportPDF((filepath) => {
    exportToPDF(filepath);
  });

  window.api.onExportLean((filepath) => {
    exportLeanCode(filepath);
  });

  // Theme change from system
  window.api.onThemeChanged((isDark) => {
    currentTheme = isDark ? 'dark' : 'light';
    applyTheme(currentTheme);
  });
}

function handleMenuAction(action) {
  switch (action) {
    case 'new':
      clearHistory();
      break;
    case 'clear-history':
      clearHistory();
      break;
    case 'toggle-theme':
      toggleTheme();
      break;
    case 'preferences':
      showModal('preferencesModal');
      break;
    case 'about':
      showModal('aboutModal');
      break;
    case 'shortcuts':
      showModal('shortcutsModal');
      break;
    case 'documentation':
      showNotification('Documentation coming soon!');
      break;
    case 'lean-path':
      showNotification('Lean path configuration coming soon!');
      break;
  }
}

// Math symbol palette functionality
function setupMathPalette() {
  const mathPaletteToggle = document.getElementById('mathPaletteToggle');
  const mathPalette = document.getElementById('mathPalette');
  const paletteClose = document.querySelector('.palette-close');
  const insertProofTemplate = document.getElementById('insertProofTemplate');

  if (!mathPaletteToggle || !mathPalette) {
    console.warn('Math palette elements not found');
    return;
  }

  // Toggle math palette
  mathPaletteToggle.addEventListener('click', () => {
    mathPalette.classList.toggle('hidden');
  });

  // Close palette
  if (paletteClose) {
    paletteClose.addEventListener('click', () => {
      mathPalette.classList.add('hidden');
    });
  }

  // Insert symbol on click
  document.querySelectorAll('.symbol-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      insertSymbol(btn.dataset.symbol);
      mathPalette.classList.add('hidden');
    });
  });

  // Insert proof template
  if (insertProofTemplate) {
    insertProofTemplate.addEventListener('click', () => {
      const template = `Assume [condition].\nLet [variable] be [type].\nThen [statement].\nTherefore [conclusion].`;
      
      const start = englishInput.selectionStart;
      const text = englishInput.value;
      
      englishInput.value = text.substring(0, start) + template + text.substring(start);
      englishInput.focus();
      
      // Select the first placeholder
      const firstPlaceholder = template.indexOf('[');
      englishInput.setSelectionRange(start + firstPlaceholder, start + firstPlaceholder + 11);
    });
  }

  // Close palette when clicking outside
  document.addEventListener('click', (e) => {
    if (!mathPalette.contains(e.target) && 
        !mathPaletteToggle.contains(e.target) && 
        !mathPalette.classList.contains('hidden')) {
      mathPalette.classList.add('hidden');
    }
  });

  // Keyboard shortcuts for math symbols
  document.addEventListener('keydown', (e) => {
    // Ctrl+M to toggle math palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault();
      mathPalette.classList.toggle('hidden');
      return;
    }

    // Alt+key shortcuts for symbols
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const shortcuts = {
        // Greek letters
        'a': 'α', 'b': 'β', 'g': 'γ', 'd': 'δ', 'e': 'ε',
        't': 'θ', 'l': 'λ', 'm': 'μ', 'p': 'π', 's': 'σ',
        'f': 'φ', 'w': 'ω',
        
        // Relations
        '/': '≠', ',': '≤', '.': '≥', '~': '≈', '=': '≡',
        'i': '∈',
        
        // Operators
        'x': '×', '*': '·', 'r': '√',
        
        // Logic
        'n': '¬', '7': '∧', '8': '∨',
        
        // Sets
        '0': '∅', 'u': '∪',
        'N': 'ℕ', 'Z': 'ℤ', 'Q': 'ℚ', 'R': 'ℝ', 'C': 'ℂ',
        
        // Arrow keys
        'ArrowRight': '→', 'ArrowLeft': '←'
      };
      
      // Shift+Alt combinations
      if (e.shiftKey) {
        const shiftShortcuts = {
          'i': '∉', 's': '∑', 'e': '∃', 'a': '∀', 'u': '∩',
          '8': '∞', 'ArrowRight': '⇒', 'ArrowLeft': '⇐'
        };
        
        if (shiftShortcuts[e.key]) {
          e.preventDefault();
          insertSymbol(shiftShortcuts[e.key]);
          return;
        }
      }
      
      if (shortcuts[e.key]) {
        e.preventDefault();
        insertSymbol(shortcuts[e.key]);
        return;
      }
    }
  });
}

// Insert symbol at cursor position
function insertSymbol(symbol) {
  const start = englishInput.selectionStart;
  const end = englishInput.selectionEnd;
  const text = englishInput.value;
  
  englishInput.value = text.substring(0, start) + symbol + text.substring(end);
  englishInput.selectionStart = englishInput.selectionEnd = start + symbol.length;
  englishInput.focus();
  
  // Trigger preview
  handleInput();
}

// Theme management
function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(currentTheme);
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

// Notification system
function showNotification(message, duration = 3000) {
  if (!notification) return;
  notification.textContent = message;
  notification.classList.remove('hidden');
  setTimeout(() => {
    notification.classList.add('hidden');
  }, duration);
}

// Status management
function setStatus(status) {
  if (!statusIndicator) return;
  statusIndicator.className = `status-${status}`;
}

// History management
function appendHistory(text) {
  const div = document.createElement('div');
  div.className = 'history-item';
  div.textContent = text;
  historyDiv.appendChild(div);
  historyDiv.scrollTop = historyDiv.scrollHeight;
}

function clearHistory() {
  messages = [];
  historyDiv.innerHTML = '';
  englishInput.value = '';
  leanOutput.textContent = '// Lean code appears here';
  validationOutput.textContent = '// Validation output appears here';
  setStatus('idle');
  currentFilePath = null;
  fileIndicator.textContent = 'Untitled';
  showNotification('History cleared');
}

// File operations
function loadFile(data) {
  clearHistory();
  englishInput.value = data.content;
  currentFilePath = data.filepath;
  fileIndicator.textContent = data.filepath.split('/').pop();
  showNotification('File opened successfully');
}

async function saveContent() {
  const content = messages.join('\n\n');
  const result = await window.api.saveContent(content);
  if (result.ok) {
    showNotification('File saved successfully');
    if (result.filepath) {
      fileIndicator.textContent = result.filepath.split('/').pop();
    }
  } else {
    showNotification('Failed to save: ' + result.error);
  }
}

async function exportLeanCode(filepath) {
  const content = leanOutput.textContent;
  if (content === '// Lean code appears here' || !content.trim()) {
    showNotification('No Lean code to export');
    return;
  }
  
  const result = await window.api.exportLeanFile(filepath, content);
  if (result.ok) {
    showNotification('Lean code exported successfully');
  } else {
    showNotification('Export failed: ' + result.error);
  }
}

function exportToPDF(filepath) {
  showNotification('PDF export not yet implemented');
}

// Copy to clipboard
async function copyLeanCode() {
  const content = leanOutput.textContent;
  if (content === '// Lean code appears here' || !content.trim()) {
    showNotification('No Lean code to copy');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(content);
    showNotification('Lean code copied to clipboard');
  } catch (err) {
    showNotification('Failed to copy: ' + err.message);
  }
}

// Pipeline execution
async function runPipeline() {
  const text = messages.join(' ').trim();
  
  if (!text) {
    leanOutput.textContent = '// No proof content yet.';
    validationOutput.textContent = '// No validation run.';
    setStatus('idle');
    return;
  }

  if (isGenerating) {
    showNotification('Already generating, please wait...');
    return;
  }

  isGenerating = true;
  englishInput.disabled = true;
  setStatus('generating');
  
  leanOutput.textContent = '// Generating Lean code...';
  validationOutput.textContent = validateToggle.checked ? '// Waiting for generation...' : '// Validation skipped.';

  try {
    const res = await window.api.generateLean(text, { validate: validateToggle.checked });
    
    if (!res.ok) {
      leanOutput.textContent = '// Error: ' + (res.error || 'Unknown error');
      validationOutput.textContent = '';
      setStatus('error');
      showNotification('Generation failed: ' + res.error);
      return;
    }

    leanOutput.textContent = res.lean || '// No Lean code generated';
    
    if (res.validation) {
      if (res.validation.ok === false || res.validation.error) {
        validationOutput.textContent = '❌ Lean validation failed:\n\n' + 
          (res.validation.error || JSON.stringify(res.validation, null, 2));
        setStatus('error');
        showNotification('Validation failed');
      } else {
        validationOutput.textContent = '✓ Lean validation passed:\n\n' + 
          (res.validation.stdout || JSON.stringify(res.validation, null, 2));
        setStatus('success');
        showNotification('Proof validated successfully!');
      }
    } else {
      validationOutput.textContent = '// Validation skipped.';
      setStatus('success');
      showNotification('Lean code generated successfully!');
    }
  } catch (err) {
    console.error('Pipeline error:', err);
    leanOutput.textContent = '// Pipeline error: ' + String(err);
    validationOutput.textContent = '';
    setStatus('error');
    showNotification('Error: ' + err.message);
  } finally {
    isGenerating = false;
    englishInput.disabled = false;
    englishInput.focus();
  }
}

// Live preview
async function runPreview() {
  const currentText = englishInput.value.trim();
  const preview = [...messages, currentText].join(' ').trim();
  
  if (!preview) {
    leanOutput.textContent = '// No content to preview';
    validationOutput.textContent = '';
    setStatus('idle');
    return;
  }

  setStatus('generating');
  leanOutput.textContent = '// Generating preview...';
  
  try {
    const res = await window.api.generateLean(preview, { validate: false });
    
    if (res.ok) {
      leanOutput.textContent = '// PREVIEW (press Ctrl+Enter to commit)\n\n' + res.lean;
      validationOutput.textContent = '// Preview mode - validation disabled';
      setStatus('idle');
    } else {
      leanOutput.textContent = '// Preview error: ' + (res.error || 'Unknown');
      setStatus('error');
    }
  } catch (err) {
    console.error('Preview error:', err);
    leanOutput.textContent = '// Preview error: ' + String(err);
    setStatus('error');
  }
}

// Keyboard handling
function handleKeydown(e) {
  // Ctrl+Enter to commit
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    clearTimeout(debounceTimer);
    
    const text = englishInput.value.trim();
    if (!text) return;
    
    messages.push(text);
    appendHistory(text);
    englishInput.value = '';
    runPipeline();
    return;
  }
  
  // Ctrl+S to save
  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    saveContent();
    return;
  }
  
  // Escape to clear
  if (e.key === 'Escape') {
    if (englishInput.value.trim()) {
      englishInput.value = '';
      if (messages.length > 0) {
        runPipeline();
      }
    }
    return;
  }
}

function handleInput() {
  clearTimeout(debounceTimer);
  
  debounceTimer = setTimeout(() => {
    if (!isGenerating) {
      runPreview();
    }
  }, 500);
}

// Modal management
function setupModalHandlers() {
  const modals = document.querySelectorAll('.modal');
  
  modals.forEach(modal => {
    const closeButtons = modal.querySelectorAll('.modal-close, .modal-cancel');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => hideModal(modal.id));
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideModal(modal.id);
      }
    });
  });

  // Preferences save
  const prefSaveBtn = document.querySelector('#preferencesModal .modal-save');
  if (prefSaveBtn) {
    prefSaveBtn.addEventListener('click', savePreferences);
  }
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    
    // Load preferences if opening preferences modal
    if (modalId === 'preferencesModal') {
      loadPreferences();
    }
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
}

function loadPreferences() {
  const autoValidate = localStorage.getItem('autoValidate') !== 'false';
  const livePreview = localStorage.getItem('livePreview') !== 'false';
  const theme = localStorage.getItem('theme') || 'system';
  
  document.getElementById('prefAutoValidate').checked = autoValidate;
  document.getElementById('prefLivePreview').checked = livePreview;
  document.getElementById('prefTheme').value = theme;
}

function savePreferences() {
  const autoValidate = document.getElementById('prefAutoValidate').checked;
  const livePreview = document.getElementById('prefLivePreview').checked;
  const theme = document.getElementById('prefTheme').value;
  
  localStorage.setItem('autoValidate', autoValidate);
  localStorage.setItem('livePreview', livePreview);
  localStorage.setItem('theme', theme);
  
  validateToggle.checked = autoValidate;
  
  if (theme !== 'system') {
    currentTheme = theme;
    applyTheme(theme);
  }
  
  hideModal('preferencesModal');
  showNotification('Preferences saved');
}

// Start the app
init();