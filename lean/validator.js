// lean/validator.js - write temp file and run Lean compiler
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const execAsync = promisify(exec);

export async function validateLean(leanCode, options = {}) {
  const {
    timeout = 30000,
    maxBuffer = 5 * 1024 * 1024,
    keepTempFile = false,
    leanVersion = 4,
    workingDir = null
  } = options;
  
  if (!leanCode || typeof leanCode !== 'string') {
    return {
      ok: false,
      error: 'Invalid Lean code: must be a non-empty string',
      stdout: '',
      stderr: ''
    };
  }
  
  const leanInstalled = await checkLeanInstalled(leanVersion);
  if (!leanInstalled.ok) {
    return {
      ok: false,
      error: leanInstalled.error,
      stdout: '',
      stderr: '',
      hint: 'Install Lean from https://leanprover.github.io/lean4/doc/setup.html'
    };
  }
  
  const tempDir = workingDir || os.tmpdir();
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const filename = `temp_proof_${uniqueId}.lean`;
  const filepath = path.join(tempDir, filename);
  
  try {
    await fs.promises.writeFile(filepath, leanCode, 'utf8');
    
    const result = await runLeanValidator(filepath, leanVersion, timeout, maxBuffer);
    
    if (!keepTempFile) {
      try {
        await fs.promises.unlink(filepath);
      } catch (cleanupErr) {
        console.warn(`Failed to clean up temp file ${filepath}:`, cleanupErr);
      }
    } else {
      result.tempFile = filepath;
    }
    
    return result;
    
  } catch (err) {
    if (!keepTempFile) {
      try {
        await fs.promises.unlink(filepath);
      } catch {
        // Ignore cleanup errors
      }
    }
    
    return {
      ok: false,
      error: `Validation failed: ${err.message}`,
      stdout: '',
      stderr: err.stderr || '',
      stack: err.stack
    };
  }
}

async function checkLeanInstalled(leanVersion) {
  try {
    const command = leanVersion === 4 ? 'lean --version' : 'lean --version';
    const { stdout } = await execAsync(command, { timeout: 5000 });
    
    const versionMatch = stdout.match(/Lean.*version\s+([\d.]+)/i);
    const installedVersion = versionMatch ? versionMatch[1] : 'unknown';
    
    if (leanVersion === 4) {
      const majorVersion = parseInt(installedVersion.split('.')[0]);
      if (majorVersion !== 4) {
        return {
          ok: false,
          error: `Expected Lean 4 but found version ${installedVersion}. Please install Lean 4.`
        };
      }
    }
    
    return {
      ok: true,
      version: installedVersion
    };
  } catch (err) {
    return {
      ok: false,
      error: `Lean ${leanVersion} not found. Please install Lean from https://leanprover.github.io/`
    };
  }
}

async function runLeanValidator(filepath, leanVersion, timeout, maxBuffer) {
  try {
    const command = leanVersion === 4 
      ? `lean "${filepath}"` 
      : `lean --make "${filepath}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer,
      cwd: path.dirname(filepath)
    });
    
    const hasErrors = parseForErrors(stdout, stderr);
    
    if (hasErrors.found) {
      return {
        ok: false,
        error: hasErrors.message,
        stdout: stdout || '',
        stderr: stderr || '',
        errors: hasErrors.errors,
        warnings: hasErrors.warnings
      };
    }
    
    const warnings = parseForWarnings(stdout, stderr);
    
    return {
      ok: true,
      stdout: stdout || 'Lean validation successful',
      stderr: stderr || '',
      warnings,
      message: warnings.length > 0 
        ? `Validation passed with ${warnings.length} warning(s). Check for 'sorry' statements.`
        : 'Lean validation successful - all proofs complete!'
    };
    
  } catch (err) {
    const stdout = err.stdout || '';
    const stderr = err.stderr || '';
    
    const parsedErrors = parseErrorMessages(stdout, stderr);
    
    return {
      ok: false,
      error: parsedErrors.summary || err.message,
      stdout,
      stderr,
      errors: parsedErrors.errors,
      exitCode: err.code
    };
  }
}

function parseForErrors(stdout, stderr) {
  const combined = (stdout + '\n' + stderr).toLowerCase();
  
  const errors = [];
  const warnings = [];
  
  const errorPatterns = [
    /error:/gi,
    /type mismatch/gi,
    /unknown identifier/gi,
    /failed to synthesize/gi,
    /tactic.*failed/gi
  ];
  
  const hasError = errorPatterns.some(pattern => pattern.test(combined));
  
  if (hasError) {
    const lines = (stdout + '\n' + stderr).split('\n');
    lines.forEach((line, idx) => {
      if (/error:/i.test(line)) {
        errors.push({
          line: idx + 1,
          message: line.trim()
        });
      }
      if (/warning:/i.test(line)) {
        warnings.push({
          line: idx + 1,
          message: line.trim()
        });
      }
    });
    
    return {
      found: true,
      message: errors.length > 0 ? errors[0].message : 'Lean validation failed',
      errors,
      warnings
    };
  }
  
  return { found: false, errors: [], warnings: [] };
}

function parseForWarnings(stdout, stderr) {
  const combined = stdout + '\n' + stderr;
  const warnings = [];
  
  if (/sorry|admit/i.test(combined)) {
    warnings.push({
      type: 'incomplete',
      message: 'Proof contains sorry/admit statements - proof is incomplete'
    });
  }
  
  const lines = combined.split('\n');
  lines.forEach((line, idx) => {
    if (/warning:/i.test(line)) {
      warnings.push({
        type: 'warning',
        line: idx + 1,
        message: line.trim()
      });
    }
  });
  
  return warnings;
}

function parseErrorMessages(stdout, stderr) {
  const combined = stdout + '\n' + stderr;
  const lines = combined.split('\n');
  
  const errors = [];
  let currentError = null;
  
  lines.forEach((line, idx) => {
    if (/^.*\.lean:\d+:\d+: error:/i.test(line)) {
      if (currentError) errors.push(currentError);
      
      const match = line.match(/^.*\.lean:(\d+):(\d+): error: (.+)/i);
      currentError = {
        line: match ? parseInt(match[1]) : idx + 1,
        column: match ? parseInt(match[2]) : 0,
        message: match ? match[3].trim() : line.trim(),
        context: []
      };
    } else if (currentError && line.trim()) {
      currentError.context.push(line.trim());
    }
  });
  
  if (currentError) errors.push(currentError);
  
  const summary = errors.length > 0
    ? `${errors.length} error(s) found. First error: ${errors[0].message}`
    : 'Lean validation failed';
  
  return { summary, errors };
}

export async function validateLeanInProject(leanCode, projectPath, options = {}) {
  const {
    moduleName = 'UserProof',
    timeout = 60000
  } = options;
  
  const lakefile = path.join(projectPath, 'lakefile.lean');
  const hasLake = fs.existsSync(lakefile);
  
  if (!hasLake) {
    return {
      ok: false,
      error: 'Not a Lake project. Expected lakefile.lean in project directory.'
    };
  }
  
  const moduleFile = path.join(projectPath, `${moduleName}.lean`);
  
  try {
    await fs.promises.writeFile(moduleFile, leanCode, 'utf8');
    
    const { stdout, stderr } = await execAsync('lake build', {
      cwd: projectPath,
      timeout,
      maxBuffer: 5 * 1024 * 1024
    });
    
    const hasErrors = parseForErrors(stdout, stderr);
    
    if (hasErrors.found) {
      return {
        ok: false,
        error: hasErrors.message,
        stdout,
        stderr,
        errors: hasErrors.errors
      };
    }
    
    return {
      ok: true,
      stdout,
      stderr,
      message: 'Lake build successful'
    };
    
  } catch (err) {
    return {
      ok: false,
      error: `Lake build failed: ${err.message}`,
      stdout: err.stdout || '',
      stderr: err.stderr || ''
    };
  } finally {
    try {
      await fs.promises.unlink(moduleFile);
    } catch {
      // Ignore
    }
  }
}

export async function getLeanInfo() {
  try {
    const { stdout: versionOut } = await execAsync('lean --version', { timeout: 5000 });
    
    let lakeVersion = null;
    try {
      const { stdout: lakeOut } = await execAsync('lake --version', { timeout: 5000 });
      lakeVersion = lakeOut.trim();
    } catch {
      // Lake not installed
    }
    
    return {
      ok: true,
      lean: versionOut.trim(),
      lake: lakeVersion,
      hasLake: lakeVersion !== null
    };
  } catch (err) {
    return {
      ok: false,
      error: 'Lean not installed or not in PATH'
    };
  }
}