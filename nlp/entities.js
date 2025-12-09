// nlp/entities.js - rule-based mathematical entity extraction

export function extractEntities(sentences) {
  const entities = new Map();
  
  if (!sentences || !Array.isArray(sentences)) {
    return [];
  }
  
  const excludeWords = new Set(['a', 'A', 'I', 'O']);
  
  sentences.forEach(s => {
    const text = s.text || s;
    if (!text || typeof text !== 'string') return;
    
    const lower = text.toLowerCase();
    
    extractVariables(text, entities, excludeWords);
    extractTypes(text, lower, entities);
    extractFunctions(text, lower, entities);
    extractConstants(text, entities);
    extractProperties(text, lower, entities);
    extractSets(text, lower, entities);
  });
  
  return Array.from(entities.values()).map(entity => ({
    ...entity,
    examples: [...new Set(entity.examples)].slice(0, 3)
  }));
}

function addEntity(entities, name, type, example) {
  if (!entities.has(name)) {
    entities.set(name, { name, type, examples: [] });
  }
  const entity = entities.get(name);
  if (example && entity.examples.length < 5) {
    entity.examples.push(example.slice(0, 80));
  }
}

function extractVariables(text, entities, excludeWords) {
  const singleLetters = [...text.matchAll(/\b([a-zA-Z])\b/g)]
    .map(m => m[1])
    .filter(v => !excludeWords.has(v));
  
  singleLetters.forEach(v => {
    addEntity(entities, v, 'variable', text);
  });
  
  const subscripted = [...text.matchAll(/\b([a-zA-Z])_?[\{\(]?(\d+)[\}\)]?/g)]
    .map(m => m[0]);
  
  subscripted.forEach(v => {
    addEntity(entities, v, 'variable', text);
  });
  
  const greekPattern = /\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|pi|phi|psi|omega)\b/gi;
  const greekMatches = [...text.matchAll(greekPattern)].map(m => m[1]);
  
  greekMatches.forEach(g => {
    addEntity(entities, g, 'variable', text);
  });
  
  const greekSymbols = text.match(/[α-ωΑ-Ω]/g) || [];
  greekSymbols.forEach(g => {
    addEntity(entities, g, 'variable', text);
  });
}

function extractTypes(text, lower, entities) {
  const typePatterns = [
    { pattern: /\b(integer|int|ℤ|Z(?=\s|$))/i, name: 'ℤ', label: 'Integer' },
    { pattern: /\b(natural|ℕ|N(?=\s|$))/i, name: 'ℕ', label: 'Natural' },
    { pattern: /\b(real|ℝ|R(?=\s|$))/i, name: 'ℝ', label: 'Real' },
    { pattern: /\b(rational|ℚ|Q(?=\s|$))/i, name: 'ℚ', label: 'Rational' },
    { pattern: /\b(complex|ℂ|C(?=\s|$))/i, name: 'ℂ', label: 'Complex' },
    { pattern: /\b(bool(ean)?|Prop|proposition)/i, name: 'Prop', label: 'Proposition' }
  ];
  
  typePatterns.forEach(({ pattern, name, label }) => {
    if (pattern.test(text)) {
      addEntity(entities, name, 'type', `${label} number/type`);
    }
  });
}

function extractFunctions(text, lower, entities) {
  const functionPattern = /\b(sin|cos|tan|log|ln|exp|sqrt|abs|floor|ceil|gcd|lcm|min|max)\b/gi;
  const functions = [...text.matchAll(functionPattern)].map(m => m[1]);
  
  functions.forEach(f => {
    addEntity(entities, f, 'function', text);
  });
  
  const customFunctions = [...text.matchAll(/\b([a-zA-Z])\s*\(/g)]
    .map(m => m[1])
    .filter(f => !['sin', 'cos', 'tan', 'log', 'exp'].includes(f.toLowerCase()));
  
  customFunctions.forEach(f => {
    addEntity(entities, f, 'function', text);
  });
}

function extractConstants(text, entities) {
  const constantPatterns = [
    { pattern: /\bπ|pi\b/gi, name: 'π' },
    { pattern: /\be\b(?!\s*=)/g, name: 'e' },
    { pattern: /\b∞|infinity\b/gi, name: '∞' },
    { pattern: /\b0\b/, name: '0' },
    { pattern: /\b1\b/, name: '1' }
  ];
  
  constantPatterns.forEach(({ pattern, name }) => {
    if (pattern.test(text)) {
      addEntity(entities, name, 'constant', text);
    }
  });
}

function extractProperties(text, lower, entities) {
  const properties = [
    'even', 'odd', 'prime', 'composite',
    'divisible', 'factor', 'multiple',
    'positive', 'negative', 'nonzero',
    'continuous', 'differentiable', 'integrable',
    'bounded', 'unbounded',
    'convergent', 'divergent',
    'injective', 'surjective', 'bijective',
    'associative', 'commutative', 'distributive'
  ];
  
  properties.forEach(prop => {
    const pattern = new RegExp(`\\b${prop}\\b`, 'i');
    if (pattern.test(lower)) {
      addEntity(entities, prop, 'property', text);
    }
  });
}

function extractSets(text, lower, entities) {
  const setDefinitions = [...text.matchAll(/\b([A-Z])\s*=\s*\{/g)]
    .map(m => m[1]);
  
  setDefinitions.forEach(s => {
    addEntity(entities, s, 'set', text);
  });
  
  if (/\b(set|subset|superset|union|intersection)\b/i.test(lower)) {
    addEntity(entities, 'Set', 'concept', text);
  }
}

export function getEntitiesByType(entities, type) {
  return entities.filter(e => e.type === type);
}

export function getVariables(entities) {
  return getEntitiesByType(entities, 'variable');
}

export function getTypes(entities) {
  return getEntitiesByType(entities, 'type');
}