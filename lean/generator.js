// lean/generator.js - deterministic mapping from proofTree -> Lean skeleton

export function generateLean(tree, options = {}) {
  const {
    theoremName = 'user_proof',
    includeComments = true,
    useAdmit = true
  } = options;
  
  if (!tree || typeof tree !== 'object') {
    return '-- Error: Invalid proof tree\n';
  }
  
  const ctx = {
    code: '',
    indent: 0,
    hypotheses: new Map(),
    variables: new Map(),
    stepCounter: 1
  };
  
  inferTypes(tree, ctx);
  
  addLine(ctx, '-- Generated Lean 4 skeleton (rule-based)');
  addLine(ctx, '');
  
  if (ctx.variables.size > 0) {
    generateVariableDeclarations(ctx);
    addLine(ctx, '');
  }
  
  const signature = generateTheoremSignature(tree, theoremName, ctx);
  addLine(ctx, signature);
  
  ctx.indent = 1;
  generateProofBody(tree, ctx, includeComments, useAdmit);
  
  return ctx.code;
}

function addLine(ctx, text = '') {
  const indentStr = '  '.repeat(ctx.indent);
  ctx.code += indentStr + text + '\n';
}

function addComment(ctx, text) {
  addLine(ctx, `-- ${escapeComment(text)}`);
}

function inferTypes(tree, ctx) {
  if (tree.entities) {
    tree.entities.forEach(entity => {
      if (entity.type === 'variable') {
        const inferredType = inferVariableType(entity, tree);
        ctx.variables.set(entity.name, inferredType);
      }
    });
  }
  
  if (tree.assumptions) {
    tree.assumptions.forEach(a => {
      scanForTypes(a.text, ctx);
    });
  }
}

function inferVariableType(entity, tree) {
  const examples = entity.examples?.join(' ').toLowerCase() || '';
  
  if (examples.includes('integer') || examples.includes('ℤ')) return 'ℤ';
  if (examples.includes('natural') || examples.includes('ℕ')) return 'ℕ';
  if (examples.includes('real') || examples.includes('ℝ')) return 'ℝ';
  if (examples.includes('rational') || examples.includes('ℚ')) return 'ℚ';
  if (examples.includes('even') || examples.includes('odd') || examples.includes('divisible')) return 'ℤ';
  if (examples.includes('prime')) return 'ℕ';
  
  if (tree.metadata?.types) {
    if (tree.metadata.types.includes('ℤ') || tree.metadata.types.includes('Integer')) return 'ℤ';
    if (tree.metadata.types.includes('ℕ') || tree.metadata.types.includes('Natural')) return 'ℕ';
    if (tree.metadata.types.includes('ℝ') || tree.metadata.types.includes('Real')) return 'ℝ';
  }
  
  return 'ℕ';
}

function scanForTypes(text, ctx) {
  const lower = text.toLowerCase();
  
  const patterns = [
    { regex: /let\s+([a-z])\s+be\s+an?\s+(integer|natural|real|rational)/i, typeMap: { integer: 'ℤ', natural: 'ℕ', real: 'ℝ', rational: 'ℚ' } },
    { regex: /([a-z])\s+(?:is|be)\s+an?\s+(even|odd)\s+(integer|number)/i, type: 'ℤ' },
    { regex: /([a-z])\s+(?:is|be)\s+an?\s+prime\s+number/i, type: 'ℕ' },
    { regex: /([a-z])\s*∈\s*([ℤℕℝℚ])/g, fromSymbol: true }
  ];
  
  patterns.forEach(pattern => {
    if (pattern.fromSymbol) {
      const matches = [...text.matchAll(pattern.regex)];
      matches.forEach(m => {
        ctx.variables.set(m[1], m[2]);
      });
    } else {
      const match = text.match(pattern.regex);
      if (match) {
        const varName = match[1];
        const type = pattern.typeMap ? pattern.typeMap[match[2].toLowerCase()] : pattern.type;
        if (type) ctx.variables.set(varName, type);
      }
    }
  });
}

function generateVariableDeclarations(ctx) {
  addComment(ctx, 'Variable declarations');
  ctx.variables.forEach((type, name) => {
    addLine(ctx, `variable (${name} : ${type})`);
  });
}

function generateTheoremSignature(tree, theoremName, ctx) {
  const goalText = tree.goal?.text || (tree.steps?.length ? tree.steps[tree.steps.length - 1].text : null);
  
  if (!goalText) {
    return `theorem ${theoremName} : True := by`;
  }
  
  const leanProp = parseGoalToLean(goalText, ctx);
  
  return `theorem ${theoremName} : ${leanProp} := by`;
}

function parseGoalToLean(text, ctx) {
  const lower = text.toLowerCase();
  
  let clean = text
    .replace(/^(therefore|hence|thus|we conclude that|this proves that)\s+/i, '')
    .trim();
  
  const evenOddMatch = clean.match(/([a-z])\s+is\s+(even|odd)/i);
  if (evenOddMatch) {
    const varName = evenOddMatch[1];
    const prop = evenOddMatch[2].charAt(0).toUpperCase() + evenOddMatch[2].slice(1);
    return `${prop} ${varName}`;
  }
  
  const divisibleMatch = clean.match(/([a-z])\s+is\s+divisible\s+by\s+([a-z])/i);
  if (divisibleMatch) {
    return `${divisibleMatch[2]} ∣ ${divisibleMatch[1]}`;
  }
  
  const existsMatch = clean.match(/([a-z])\s*=\s*(.+)\s+for some\s+([a-z])/i);
  if (existsMatch) {
    return `∃ ${existsMatch[3]}, ${existsMatch[1]} = ${existsMatch[2]}`;
  }
  
  const forallMatch = clean.match(/for all\s+([a-z]),\s*(.+)/i);
  if (forallMatch) {
    return `∀ ${forallMatch[1]}, ${forallMatch[2]}`;
  }
  
  return `True -- TODO: formalize "${clean}"`;
}

function generateProofBody(tree, ctx, includeComments, useAdmit) {
  if (tree.assumptions?.length) {
    addComment(ctx, 'Assumptions');
    tree.assumptions.forEach((a, i) => {
      generateAssumption(a, i, ctx, includeComments, useAdmit);
    });
    addLine(ctx);
  }
  
  if (tree.steps?.length) {
    addComment(ctx, 'Proof steps');
    tree.steps.forEach(step => {
      generateStep(step, tree, ctx, includeComments, useAdmit);
    });
    addLine(ctx);
  }
  
  if (tree.goal) {
    addComment(ctx, `Goal: ${tree.goal.text}`);
  }
  
  if (useAdmit) {
    addLine(ctx, 'sorry');
  }
}

function generateAssumption(assumption, index, ctx, includeComments, useAdmit) {
  const hypName = `h${index + 1}`;
  ctx.hypotheses.set(assumption.id, hypName);
  
  if (includeComments) {
    addComment(ctx, `Assumption ${index + 1}: ${assumption.text}`);
  }
  
  const leanAssertion = parseAssumptionToLean(assumption.text, ctx);
  
  addLine(ctx, `have ${hypName} : ${leanAssertion} := by`);
  ctx.indent++;
  if (useAdmit) {
    addLine(ctx, 'sorry');
  }
  ctx.indent--;
  addLine(ctx);
}

function parseAssumptionToLean(text, ctx) {
  const lower = text.toLowerCase();
  
  let clean = text.replace(/^(assume|suppose|let)\s+/i, '').trim();
  
  const evenOddMatch = clean.match(/([a-z])\s+(?:is|be)\s+(?:an?\s+)?(even|odd)(?:\s+integer)?/i);
  if (evenOddMatch) {
    const varName = evenOddMatch[1];
    const prop = evenOddMatch[2].charAt(0).toUpperCase() + evenOddMatch[2].slice(1);
    return `${prop} ${varName}`;
  }
  
  const primeMatch = clean.match(/([a-z])\s+(?:is|be)\s+(?:a\s+)?prime(?:\s+number)?/i);
  if (primeMatch) {
    return `Nat.Prime ${primeMatch[1]}`;
  }
  
  const ineqMatch = clean.match(/([a-z])\s*([>≥<≤=≠])\s*(\d+)/);
  if (ineqMatch) {
    const op = { '>': '>', '≥': '≥', '<': '<', '≤': '≤', '=': '=', '≠': '≠' }[ineqMatch[2]] || ineqMatch[2];
    return `${ineqMatch[1]} ${op} ${ineqMatch[3]}`;
  }
  
  return `True -- TODO: formalize "${clean}"`;
}

function generateStep(step, tree, ctx, includeComments, useAdmit) {
  const stepName = `step_${step.id}`;
  
  if (includeComments) {
    addComment(ctx, `Step ${step.id} (${step.type}): ${step.text}`);
  }
  
  const lower = step.text.toLowerCase();
  
  switch (step.type) {
    case 'induction':
      generateInduction(step, ctx, useAdmit);
      break;
      
    case 'contradiction':
      generateContradiction(step, ctx, useAdmit);
      break;
      
    case 'case':
      generateCaseAnalysis(step, ctx, useAdmit);
      break;
      
    case 'existential':
      generateExistential(step, ctx, useAdmit);
      break;
      
    case 'universal':
      generateUniversal(step, ctx, useAdmit);
      break;
      
    case 'implication':
      generateImplication(step, ctx, useAdmit);
      break;
      
    case 'definition':
      generateDefinition(step, ctx);
      break;
      
    case 'arithmetic':
    case 'algebraic':
      generateAlgebraic(step, ctx, useAdmit);
      break;
      
    default:
      generateGenericStep(step, ctx, useAdmit);
  }
  
  addLine(ctx);
}

function generateInduction(step, ctx, useAdmit) {
  const varMatch = step.text.match(/induction\s+on\s+([a-z])/i) ||
                   step.text.match(/\b([a-z])\b/i);
  const inductVar = varMatch ? varMatch[1] : 'n';
  
  addLine(ctx, `induction ${inductVar} with`);
  ctx.indent++;
  
  addLine(ctx, `| zero =>`);
  ctx.indent++;
  if (step.substeps?.baseCase) {
    addComment(ctx, step.substeps.baseCase);
  } else {
    addComment(ctx, 'Base case');
  }
  if (useAdmit) addLine(ctx, 'sorry');
  ctx.indent--;
  
  addLine(ctx, `| succ ${inductVar}' ih =>`);
  ctx.indent++;
  if (step.substeps?.inductiveStep) {
    addComment(ctx, step.substeps.inductiveStep);
  } else {
    addComment(ctx, 'Inductive step, ih is the inductive hypothesis');
  }
  if (useAdmit) addLine(ctx, 'sorry');
  ctx.indent--;
  
  ctx.indent--;
}

function generateContradiction(step, ctx, useAdmit) {
  addLine(ctx, `by_contra h_contra`);
  ctx.indent++;
  addComment(ctx, 'Assume the negation and derive a contradiction');
  if (useAdmit) addLine(ctx, 'sorry');
  ctx.indent--;
}

function generateCaseAnalysis(step, ctx, useAdmit) {
  const target = extractCaseTarget(step.text);
  
  if (target) {
    addLine(ctx, `cases ${target} with`);
  } else {
    addLine(ctx, `-- Case analysis (specify target)`);
    addLine(ctx, `cases _ with`);
  }
  
  ctx.indent++;
  addLine(ctx, `| inl h_left =>`);
  ctx.indent++;
  if (useAdmit) addLine(ctx, 'sorry');
  ctx.indent--;
  
  addLine(ctx, `| inr h_right =>`);
  ctx.indent++;
  if (useAdmit) addLine(ctx, 'sorry');
  ctx.indent--;
  ctx.indent--;
}

function generateExistential(step, ctx, useAdmit) {
  const witnessMatch = step.text.match(/(?:exists?|choose|take)\s+([a-z](?:_\d+)?)/i) ||
                       step.text.match(/\b([a-z])\s*=\s*/i);
  const witness = witnessMatch ? witnessMatch[1] : '_';
  
  addLine(ctx, `use ${witness}`);
  if (useAdmit) {
    ctx.indent++;
    addComment(ctx, `Prove the property holds for ${witness}`);
    addLine(ctx, 'sorry');
    ctx.indent--;
  }
}

function generateUniversal(step, ctx, useAdmit) {
  const varMatch = step.text.match(/for (?:all|every)\s+([a-z])/i);
  const var_name = varMatch ? varMatch[1] : 'x';
  
  addLine(ctx, `intro ${var_name}`);
  if (useAdmit) {
    ctx.indent++;
    addComment(ctx, `Show the property for arbitrary ${var_name}`);
    addLine(ctx, 'sorry');
    ctx.indent--;
  }
}

function generateImplication(step, ctx, useAdmit) {
  addLine(ctx, `intro h_premise`);
  if (useAdmit) {
    ctx.indent++;
    addComment(ctx, 'Assume the premise and prove the conclusion');
    addLine(ctx, 'sorry');
    ctx.indent--;
  }
}

function generateDefinition(step, ctx) {
  if (/simplif/i.test(step.text)) {
    addLine(ctx, `simp [*]`);
  } else if (/unfold|expand/i.test(step.text)) {
    addLine(ctx, `unfold _ -- specify definition to unfold`);
  } else {
    addLine(ctx, `rw [_] -- specify rewrite rule`);
  }
}

function generateAlgebraic(step, ctx, useAdmit) {
  addLine(ctx, `have h_calc : _ := by`);
  ctx.indent++;
  
  if (/ring|algebra/i.test(step.text.toLowerCase())) {
    addLine(ctx, `ring`);
  } else if (/linear|add|subtract/i.test(step.text.toLowerCase())) {
    addLine(ctx, `linarith`);
  } else {
    addComment(ctx, 'Algebraic manipulation');
    if (useAdmit) addLine(ctx, 'sorry');
  }
  
  ctx.indent--;
}

function generateGenericStep(step, ctx, useAdmit) {
  const stepName = `h_${step.id}`;
  addLine(ctx, `have ${stepName} : _ := by`);
  ctx.indent++;
  if (useAdmit) addLine(ctx, 'sorry');
  ctx.indent--;
}

function extractCaseTarget(text) {
  const patterns = [
    /consider\s+the\s+case\s+(?:where|when|of)\s+([a-z_]+)/i,
    /cases?\s+on\s+([a-z_]+)/i,
    /by\s+cases\s+on\s+([a-z_]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function escapeComment(s) {
  return String(s).replace(/\*\//g, '* /').replace(/\n/g, ' ');
}

export function generateLeanWithCustomHeader(tree, header, theoremName = 'main') {
  const code = generateLean(tree, { theoremName });
  return header + '\n\n' + code;
}