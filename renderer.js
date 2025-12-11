// renderer.js - Enhanced Mathematical Reasoning Notebook

const englishInput = document.getElementById('englishInput');
const leanOutput = document.getElementById('leanOutput');
const validationOutput = document.getElementById('validationOutput');
const validationPane = document.getElementById('validationPane');
const validationHeader = document.getElementById('validationHeader');
const historyContent = document.getElementById('historyContent');
const historySidebar = document.getElementById('historySidebar');
const mathPalette = document.getElementById('mathPalette');
const paletteToggle = document.getElementById('paletteToggle');
const themeToggle = document.getElementById('themeToggle');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const copyLeanBtn = document.getElementById('copyLeanBtn');
const formatLeanBtn = document.getElementById('formatLeanBtn');
const validateToggle = document.getElementById('validateToggle');
const lineNumbers = document.getElementById('lineNumbers');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const lineCount = document.getElementById('lineCount');
const autosaveIndicator = document.getElementById('autosaveIndicator');
const notification = document.getElementById('notification');
const templateBtn = document.getElementById('templateBtn');
const structureBtn = document.getElementById('structureBtn');
const saveBtn = document.getElementById('saveBtn');
const commandPalette = document.getElementById('commandPalette');
const commandInput = document.getElementById('commandInput');
const commandList = document.getElementById('commandList');

let messages = [];
let isGenerating = false;
let currentTheme = 'light';
let paletteState = 'collapsed';
let autosaveTimeout = null;
let currentLine = 1;

// Commands for palette
const COMMANDS = [
  { name: 'Generate Lean Code', action: 'generate', shortcut: 'Ctrl+Enter' },
  { name: 'Validate Proof', action: 'validate', shortcut: 'Ctrl+Shift+V' },
  { name: 'Insert Template', action: 'template', shortcut: 'Ctrl+T' },
  { name: 'Clear Editor', action: 'clear', shortcut: 'Ctrl+K' },
  { name: 'Copy Lean Code', action: 'copy', shortcut: 'Ctrl+C' },
  { name: 'Toggle Math Palette', action: 'togglePalette', shortcut: 'Alt+M' },
  { name: 'Toggle Theme', action: 'theme', shortcut: 'Ctrl+Shift+T' },
  { name: 'Save Proof', action: 'save', shortcut: 'Ctrl+S' },
  { name: 'Show Structure', action: 'structure', shortcut: 'Ctrl+Shift+S' },
];

// Initialize
function init() {
  currentTheme = localStorage.getItem('theme') || 'light';
  applyTheme(currentTheme);
  setupEventListeners();
  setupMathSymbols();
  updateLineNumbers();
  updateStats();
  loadAutosave();
  englishInput.focus();
}

function setupEventListeners() {
  themeToggle.addEventListener('click', toggleTheme);
  paletteToggle.addEventListener('click', cyclePaletteState);
  generateBtn.addEventListener('click', handleGenerate);
  clearBtn.addEventListener('click', clearEditor);
  clearHistoryBtn.addEventListener('click', clearHistory);
  copyLeanBtn.addEventListener('click', copyLean);
  formatLeanBtn.addEventListener('click', () => showNotification('Format feature coming soon'));
  validationHeader.addEventListener('click', toggleValidation);
  englishInput.addEventListener('input', handleInput);
  englishInput.addEventListener('keydown', handleKeydown);
  englishInput.addEventListener('scroll', syncLineNumbersScroll);
  templateBtn.addEventListener('click', insertTemplate);
  structureBtn.addEventListener('click', showStructure);
  saveBtn.addEventListener('click', saveProof);

  // Command palette
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      toggleCommandPalette();
    }
    if (e.key === 'Escape' && !commandPalette.classList.contains('hidden')) {
      toggleCommandPalette();
    }
  });

  commandInput.addEventListener('input', filterCommands);
  commandPalette.addEventListener('click', (e) => {
    if (e.target === commandPalette) {
      toggleCommandPalette();
    }
  });
}

// Line Numbering
function updateLineNumbers() {
  const text = englishInput.value;
  const lines = text.split('\n').length;
  
  let html = '';
  for (let i = 1; i <= Math.max(lines, 20); i++) {
    const activeClass = i === currentLine ? 'active' : '';
    html += `<span class="line-number ${activeClass}">${i}</span>`;
  }
  
  lineNumbers.innerHTML = html;
}

function syncLineNumbersScroll() {
  lineNumbers.scrollTop = englishInput.scrollTop;
}

function getCurrentLine() {
  const text = englishInput.value.substring(0, englishInput.selectionStart);
  return text.split('\n').length;
}

// Stats & Autosave
function updateStats() {
  const text = englishInput.value;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text.split('\n').length;
  
  charCount.textContent = `${chars} chars`;
  wordCount.textContent = `${words} words`;
  lineCount.textContent = `Line ${getCurrentLine()}`;
  currentLine = getCurrentLine();
  
  updateLineNumbers();
}

function handleInput() {
  updateStats();
  
  clearTimeout(autosaveTimeout);
  autosaveTimeout = setTimeout(() => {
    saveToLocalStorage();
    showAutosaveIndicator();
  }, 2000);
}

function saveToLocalStorage() {
  const data = {
    content: englishInput.value,
    timestamp: Date.now()
  };
  localStorage.setItem('proof-autosave', JSON.stringify(data));
}

function loadAutosave() {
  const saved = localStorage.getItem('proof-autosave');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        if (data.content && confirm('Restore previous session?')) {
          englishInput.value = data.content;
          updateStats();
        }
      }
    } catch (e) {
      console.error('Failed to load autosave:', e);
    }
  }
}

function showAutosaveIndicator() {
  autosaveIndicator.classList.remove('hidden');
  setTimeout(() => {
    autosaveIndicator.classList.add('hidden');
  }, 2000);
}

// Validation Display
function displayValidationResults(validation) {
  validationOutput.innerHTML = '';
  
  if (validation.ok === false || validation.error) {
    const item = createValidationItem(
      'error',
      '✗',
      'Validation Failed',
      validation.error || 'Unknown error',
      null
    );
    validationOutput.appendChild(item);
  } else {
    const item = createValidationItem(
      'success',
      '✓',
      'Validation Passed',
      'Proof is mathematically sound!',
      null
    );
    validationOutput.appendChild(item);
    
    if (validation.stdout) {
      const details = document.createElement('div');
      details.className = 'validation-item info';
      details.innerHTML = `
        <span class="validation-icon">ℹ</span>
        <div class="validation-content">
          <div class="validation-message">Details</div>
          <div class="validation-details">${escapeHtml(validation.stdout)}</div>
        </div>
      `;
      validationOutput.appendChild(details);
    }
  }
}

function createValidationItem(type, icon, message, details, lineNumber) {
  const item = document.createElement('div');
  item.className = `validation-item ${type}`;
  
  const jumpBtn = lineNumber ? 
    `<button class="validation-jump" onclick="jumpToLine(${lineNumber})">Jump to line ${lineNumber}</button>` : '';
  
  item.innerHTML = `
    <span class="validation-icon">${icon}</span>
    <div class="validation-content">
      <div class="validation-message">${message}</div>
      <div class="validation-details">${escapeHtml(details)}</div>
      ${jumpBtn}
    </div>
  `;
  
  return item;
}

// History
function addHistoryItem(text, status = 'pending') {
  const item = document.createElement('div');
  item.className = 'history-item';
  item.dataset.status = status;
  item.dataset.text = text;
  
  const time = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const statusBadge = getStatusBadge(status);
  
  item.innerHTML = `
    <div class="history-item-header">
      <div class="history-item-time">${time}</div>
      ${statusBadge}
    </div>
    <div class="history-item-text">${escapeHtml(text)}</div>
    <div class="history-item-actions">
      <button class="history-action-btn restore-btn">Restore</button>
      <button class="history-action-btn compare-btn">Compare</button>
      <button class="history-action-btn delete-btn">Delete</button>
    </div>
  `;
  
  item.querySelector('.restore-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    englishInput.value = text;
    updateStats();
    showNotification('Restored from history');
  });
  
  item.querySelector('.compare-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showNotification('Compare view coming soon');
  });
  
  item.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    item.remove();
    const index = messages.indexOf(text);
    if (index > -1) messages.splice(index, 1);
    showNotification('Deleted from history');
  });
  
  item.addEventListener('click', () => {
    englishInput.value = text;
    updateStats();
  });
  
  if (historyContent.children.length === 1 && 
      historyContent.children[0].textContent.includes('No proofs yet')) {
    historyContent.innerHTML = '';
  }
  
  historyContent.insertBefore(item, historyContent.firstChild);
}

function getStatusBadge(status) {
  const badges = {
    validated: '<div class="history-item-status validated">✓ Valid</div>',
    failed: '<div class="history-item-status failed">✗ Failed</div>',
    pending: '<div class="history-item-status pending">⋯ Pending</div>'
  };
  return badges[status] || badges.pending;
}

function updateHistoryItemStatus(text, status) {
  const items = historyContent.querySelectorAll('.history-item');
  items.forEach(item => {
    if (item.dataset.text === text) {
      const header = item.querySelector('.history-item-header');
      const oldBadge = header.querySelector('.history-item-status');
      if (oldBadge) oldBadge.remove();
      header.insertAdjacentHTML('beforeend', getStatusBadge(status));
      item.dataset.status = status;
    }
  });
}

// Lean Syntax Highlighting
function applyLeanSyntaxHighlighting(code) {
  const keywords = ['theorem', 'lemma', 'def', 'example', 'axiom', 'variable', 
                   'have', 'show', 'by', 'from', 'fun', 'match', 'with', 'end',
                   'if', 'then', 'else', 'let', 'in', 'do', 'return'];
  
  const types = ['Nat', 'Int', 'Real', 'Bool', 'Prop', 'Type', 'Sort'];
  
  const tactics = ['intro', 'apply', 'exact', 'simp', 'ring', 'omega', 'cases',
                  'induction', 'rw', 'rewrite', 'calc', 'constructor', 'split',
                  'left', 'right', 'exists', 'use'];
  
  let highlighted = escapeHtml(code);
  
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b(${kw})\\b`, 'g');
    highlighted = highlighted.replace(regex, '<span class="lean-keyword">$1</span>');
  });
  
  types.forEach(type => {
    const regex = new RegExp(`\\b(${type})\\b`, 'g');
    highlighted = highlighted.replace(regex, '<span class="lean-type">$1</span>');
  });
  
  tactics.forEach(tactic => {
    const regex = new RegExp(`\\b(${tactic})\\b`, 'g');
    highlighted = highlighted.replace(regex, '<span class="lean-tactic">$1</span>');
  });
  
  highlighted = highlighted.replace(/(--[^\n]*)/g, '<span class="lean-comment">$1</span>');
  highlighted = highlighted.replace(/"([^"]*)"/g, '<span class="lean-string">"$1"</span>');
  
  return highlighted;
}

// Jump to Line
window.jumpToLine = function(lineNum) {
  const lines = englishInput.value.split('\n');
  let charCount = 0;
  
  for (let i = 0; i < Math.min(lineNum - 1, lines.length); i++) {
    charCount += lines[i].length + 1;
  }
  
  englishInput.focus();
  englishInput.setSelectionRange(charCount, charCount + (lines[lineNum - 1]?.length || 0));
  englishInput.scrollTop = (lineNum - 1) * 27;
  
  showNotification(`Jumped to line ${lineNum}`);
};

// Command Palette
function toggleCommandPalette() {
  commandPalette.classList.toggle('hidden');
  
  if (!commandPalette.classList.contains('hidden')) {
    commandInput.value = '';
    commandInput.focus();
    renderCommands(COMMANDS);
  }
}

function filterCommands() {
  const query = commandInput.value.toLowerCase();
  const filtered = COMMANDS.filter(cmd => 
    cmd.name.toLowerCase().includes(query) || 
    cmd.action.toLowerCase().includes(query)
  );
  renderCommands(filtered);
}

function renderCommands(commands) {
  commandList.innerHTML = '';
  
  commands.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = `command-item ${index === 0 ? 'active' : ''}`;
    item.innerHTML = `
      <span class="command-name">${cmd.name}</span>
      <span class="command-shortcut">${cmd.shortcut || ''}</span>
    `;
    
    item.addEventListener('click', () => executeCommand(cmd.action));
    commandList.appendChild(item);
  });
}

function executeCommand(action) {
  toggleCommandPalette();
  
  const actions = {
    generate: handleGenerate,
    validate: handleGenerate,
    template: insertTemplate,
    clear: clearEditor,
    copy: copyLean,
    togglePalette: cyclePaletteState,
    theme: toggleTheme,
    save: saveProof,
    structure: showStructure
  };
  
  if (actions[action]) {
    actions[action]();
  }
}

// Core Functions
async function handleGenerate() {
  const text = englishInput.value.trim();
  
  if (!text) {
    showNotification('Please write a proof first');
    return;
  }

  if (isGenerating) {
    showNotification('Already generating...');
    return;
  }

  messages.push(text);
  addHistoryItem(text, 'pending');
  
  isGenerating = true;
  generateBtn.textContent = 'Generating...';
  generateBtn.disabled = true;
  
  leanOutput.textContent = '-- Generating Lean code...\n-- Please wait...';
  validationOutput.textContent = 'Waiting for generation...';

  try {
    const res = await window.api.generateLean(text, { validate: validateToggle.checked });
    
    if (!res.ok) {
      leanOutput.textContent = '-- Error: ' + (res.error || 'Unknown error');
      validationOutput.textContent = 'Generation failed';
      updateHistoryItemStatus(text, 'failed');
      showNotification('Generation failed: ' + res.error);
      return;
    }

    leanOutput.innerHTML = applyLeanSyntaxHighlighting(res.lean || '-- No Lean code generated');
    
    if (res.validation) {
      displayValidationResults(res.validation);
      updateHistoryItemStatus(text, res.validation.ok ? 'validated' : 'failed');
    } else {
      validationOutput.textContent = 'Validation skipped';
      updateHistoryItemStatus(text, 'pending');
      showNotification('Generated successfully');
    }

    if (validateToggle.checked && validationPane.classList.contains('collapsed')) {
      toggleValidation();
    }

  } catch (err) {
    console.error('Error:', err);
    leanOutput.textContent = '-- Error: ' + String(err);
    validationOutput.textContent = 'Pipeline error';
    updateHistoryItemStatus(text, 'failed');
    showNotification('Error: ' + err.message);
  } finally {
    isGenerating = false;
    generateBtn.textContent = 'Generate';
    generateBtn.disabled = false;
  }
}

function clearEditor() {
  if (englishInput.value && !confirm('Clear the editor?')) return;
  englishInput.value = '';
  updateStats();
  leanOutput.textContent = '-- Lean code will appear here\n-- \n-- Write your proof above and click Generate';
  validationOutput.textContent = 'No validation run yet.';
  englishInput.focus();
}

function clearHistory() {
  if (!confirm('Clear all history?')) return;
  messages = [];
  historyContent.innerHTML = '<div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 12px;">No proofs yet</div>';
  showNotification('History cleared');
}

async function copyLean() {
  const content = leanOutput.textContent;
  if (!content || content.includes('will appear here')) {
    showNotification('No Lean code to copy');
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
    showNotification('Copied to clipboard');
  } catch (err) {
    showNotification('Failed to copy');
  }
}

function insertTemplate() {
  const template = `Theorem: [statement]

Proof:
Assume [condition].
Let [variable] be [type].
Then [intermediate result].
Therefore [conclusion]. ∎`;
  
  const start = englishInput.selectionStart;
  const text = englishInput.value;
  
  englishInput.value = text.substring(0, start) + template + text.substring(start);
  englishInput.focus();
  updateStats();
  showNotification('Template inserted');
}

function showStructure() {
  showNotification('Structure view coming soon');
}

function saveProof() {
  saveToLocalStorage();
  showNotification('Proof saved locally');
}

// Math symbols
function setupMathSymbols() {
  document.querySelectorAll('.symbol-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      insertSymbol(btn.dataset.symbol);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const shortcuts = {
        'a': 'α', 'b': 'β', 'g': 'γ', 'd': 'δ', 'e': 'ε',
        't': 'θ', 'l': 'λ', 'm': 'μ', 'p': 'π', 's': 'σ',
        'f': 'φ', 'w': 'ω', '/': '≠', ',': '≤', '.': '≥',
        '~': '≈', '=': '≡', 'i': '∈', 'x': '×', '*': '·',
        'r': '√', 'n': '¬', '7': '∧', '8': '∨', '0': '∅',
        'u': '∪', 'N': 'ℕ', 'Z': 'ℤ', 'Q': 'ℚ', 'R': 'ℝ', 'C': 'ℂ',
      };
      
      if (e.shiftKey) {
        const shiftShortcuts = {
          'i': '∉', 's': '∑', 'e': '∃', 'a': '∀', 'u': '∩', '8': '∞'
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
      }
    }
  });
}

function insertSymbol(symbol) {
  const start = englishInput.selectionStart;
  const end = englishInput.selectionEnd;
  const text = englishInput.value;
  
  englishInput.value = text.substring(0, start) + symbol + text.substring(end);
  englishInput.selectionStart = englishInput.selectionEnd = start + symbol.length;
  englishInput.focus();
  updateStats();
}

// Palette cycling
function cyclePaletteState() {
  mathPalette.classList.remove('collapsed', 'icon-bar', 'expanded');
  
  if (paletteState === 'collapsed') {
    paletteState = 'icon-bar';
    paletteToggle.textContent = '▶';
  } else if (paletteState === 'icon-bar') {
    paletteState = 'expanded';
    paletteToggle.textContent = '◀';
  } else {
    paletteState = 'collapsed';
    paletteToggle.textContent = 'Σ';
  }
  
  mathPalette.classList.add(paletteState);
}

// Theme
function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(currentTheme);
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

// Validation toggle
function toggleValidation() {
  validationPane.classList.toggle('collapsed');
  const toggle = validationPane.querySelector('.validation-toggle');
  toggle.textContent = validationPane.classList.contains('collapsed') ? '▶' : '▼';
}

// Keyboard shortcuts
function handleKeydown(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleGenerate();
  }
  
  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    saveProof();
  }
  
  if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    clearEditor();
  }
  
  if (e.key === 'm' && e.altKey) {
    e.preventDefault();
    cyclePaletteState();
  }
}

// Notification
function showNotification(message, duration = 2000) {
  notification.textContent = message;
  notification.classList.remove('hidden');
  setTimeout(() => {
    notification.classList.add('hidden');
  }, duration);
}

// Utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
init();