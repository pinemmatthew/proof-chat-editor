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

// nlp/proofTree.js - build a DAG-like proof tree with smart dependency inference

export function buildProofTree(sentences, entities) {
  if (!sentences || !Array.isArray(sentences)) {
    return { assumptions: [], steps: [], goal: null, entities: [] };
  }
  
  const tree = {
    assumptions: [],
    steps: [],
    goal: null,
    entities: entities || [],
    metadata: {
      proofTechniques: new Set(),
      variables: new Set(),
      types: new Set()
    }
  };
  
  let stepId = 0;
  const createdSteps = [];
  const variableScope = new Map();
  const caseStack = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (!s || !s.text) continue;
    
    if (s.type) tree.metadata.proofTechniques.add(s.type);
    
    switch (s.type) {
      case 'assumption':
        handleAssumption(s, tree, variableScope);
        break;
        
      case 'conclusion':
        handleConclusion(s, tree, createdSteps);
        break;
        
      case 'induction':
        handleInduction(s, tree, createdSteps, variableScope, ++stepId);
        break;
        
      case 'contradiction':
        handleContradiction(s, tree, createdSteps, ++stepId);
        break;
        
      case 'case':
        handleCase(s, tree, createdSteps, caseStack, ++stepId);
        break;
        
      case 'existential':
        handleExistential(s, tree, createdSteps, variableScope, ++stepId);
        break;
        
      case 'universal':
        handleUniversal(s, tree, createdSteps, ++stepId);
        break;
        
      default:
        handleStep(s, i, tree, createdSteps, variableScope, entities, ++stepId);
    }
  }
  
  tree.metadata.proofTechniques = Array.from(tree.metadata.proofTechniques);
  tree.metadata.variables = Array.from(tree.metadata.variables);
  tree.metadata.types = Array.from(tree.metadata.types);
  
  validateTree(tree);
  
  return tree;
}

function handleAssumption(s, tree, variableScope) {
  const assumptionId = `a${tree.assumptions.length + 1}`;
  const assumption = {
    id: assumptionId,
    text: s.text,
    variables: extractVariablesFromText(s.text)
  };
  
  assumption.variables.forEach(v => {
    if (!variableScope.has(v)) {
      variableScope.set(v, [assumptionId]);
    } else {
      variableScope.get(v).push(assumptionId);
    }
    tree.metadata.variables.add(v);
  });
  
  tree.assumptions.push(assumption);
}

function handleConclusion(s, tree, createdSteps) {
  const goalDeps = [];
  
  createdSteps.forEach(st => goalDeps.push(st.id));
  
  if (goalDeps.length === 0) {
    tree.assumptions.forEach(a => goalDeps.push(a.id));
  }
  
  tree.goal = {
    id: 'goal',
    text: s.text,
    dependsOn: Array.from(new Set(goalDeps)),
    variables: extractVariablesFromText(s.text)
  };
}

function handleInduction(s, tree, createdSteps, variableScope, stepId) {
  const step = {
    id: `s${stepId}`,
    text: s.text,
    type: 'induction',
    technique: 'induction',
    dependsOn: [],
    substeps: {
      baseCase: null,
      inductiveStep: null
    }
  };
  
  const inductionVar = extractInductionVariable(s.text);
  if (inductionVar && variableScope.has(inductionVar)) {
    step.dependsOn.push(...variableScope.get(inductionVar));
  }
  
  if (createdSteps.length > 0) {
    step.dependsOn.push(createdSteps[createdSteps.length - 1].id);
  }
  
  step.dependsOn = Array.from(new Set(step.dependsOn));
  createdSteps.push(step);
  tree.steps.push(step);
}

function handleContradiction(s, tree, createdSteps, stepId) {
  const step = {
    id: `s${stepId}`,
    text: s.text,
    type: 'contradiction',
    technique: 'proof_by_contradiction',
    dependsOn: []
  };
  
  const lookback = Math.min(3, createdSteps.length);
  for (let i = createdSteps.length - lookback; i < createdSteps.length; i++) {
    step.dependsOn.push(createdSteps[i].id);
  }
  
  createdSteps.push(step);
  tree.steps.push(step);
}

function handleCase(s, tree, createdSteps, caseStack, stepId) {
  const step = {
    id: `s${stepId}`,
    text: s.text,
    type: 'case',
    technique: 'case_analysis',
    dependsOn: [],
    caseNumber: caseStack.length + 1
  };
  
  if (createdSteps.length > 0) {
    const prev = createdSteps[createdSteps.length - 1];
    step.dependsOn.push(prev.id);
  }
  
  caseStack.push(step.id);
  createdSteps.push(step);
  tree.steps.push(step);
}

function handleExistential(s, tree, createdSteps, variableScope, stepId) {
  const step = {
    id: `s${stepId}`,
    text: s.text,
    type: 'existential',
    technique: 'existential_intro',
    dependsOn: [],
    variables: extractVariablesFromText(s.text)
  };
  
  step.variables.forEach(v => {
    if (!variableScope.has(v)) {
      variableScope.set(v, [step.id]);
    }
    tree.metadata.variables.add(v);
  });
  
  if (createdSteps.length > 0) {
    step.dependsOn.push(createdSteps[createdSteps.length - 1].id);
  }
  
  createdSteps.push(step);
  tree.steps.push(step);
}

function handleUniversal(s, tree, createdSteps, stepId) {
  const step = {
    id: `s${stepId}`,
    text: s.text,
    type: 'universal',
    technique: 'universal_intro',
    dependsOn: []
  };
  
  if (createdSteps.length > 0) {
    step.dependsOn.push(createdSteps[createdSteps.length - 1].id);
  }
  
  createdSteps.push(step);
  tree.steps.push(step);
}

function handleStep(s, index, tree, createdSteps, variableScope, entities, stepId) {
  const step = {
    id: `s${stepId}`,
    text: s.text,
    type: s.type || 'step',
    dependsOn: [],
    variables: extractVariablesFromText(s.text)
  };
  
  const deps = inferDependencies(s, index, tree, createdSteps, variableScope, entities);
  step.dependsOn = deps;
  
  createdSteps.push(step);
  tree.steps.push(step);
}

function inferDependencies(sentence, index, tree, createdSteps, variableScope, entities) {
  const deps = new Set();
  const text = sentence.text;
  const lower = text.toLowerCase();
  const sentenceVars = extractVariablesFromText(text);
  
  const referencePatterns = [
    /\b(by|from|using)\s+(step|assumption|equation)\s+(\d+)/gi,
    /\b(above|previous|earlier)\s+(step|statement|equation)/gi
  ];
  
  referencePatterns.forEach(pattern => {
    if (pattern.test(lower)) {
      if (createdSteps.length > 0) {
        deps.add(createdSteps[createdSteps.length - 1].id);
      }
    }
  });
  
  sentenceVars.forEach(v => {
    if (variableScope.has(v)) {
      const sources = variableScope.get(v);
      sources.forEach(src => deps.add(src));
    }
  });
  
  if (entities && Array.isArray(entities)) {
    entities.forEach(entity => {
      if (entity.type === 'variable' && sentenceVars.includes(entity.name)) {
        tree.assumptions.forEach(a => {
          if (a.variables && a.variables.includes(entity.name)) {
            deps.add(a.id);
          }
        });
      }
    });
  }
  
  if (deps.size === 0 && createdSteps.length > 0) {
    deps.add(createdSteps[createdSteps.length - 1].id);
  }
  
  if (deps.size === 0 && tree.assumptions.length > 0) {
    let foundAssumption = false;
    tree.assumptions.forEach(a => {
      if (a.variables && a.variables.some(v => sentenceVars.includes(v))) {
        deps.add(a.id);
        foundAssumption = true;
      }
    });
    
    if (!foundAssumption) {
      deps.add(tree.assumptions[0].id);
    }
  }
  
  return Array.from(deps);
}

function extractVariablesFromText(text) {
  if (!text) return [];
  
  const vars = new Set();
  
  const excludeWords = new Set(['a', 'A', 'I', 'O']);
  const singleLetters = [...text.matchAll(/\b([a-zA-Z])\b/g)]
    .map(m => m[1])
    .filter(v => !excludeWords.has(v));
  
  singleLetters.forEach(v => vars.add(v));
  
  const subscripted = [...text.matchAll(/\b([a-zA-Z])_?[\{\(]?(\d+)[\}\)]?/g)]
    .map(m => m[0]);
  
  subscripted.forEach(v => vars.add(v));
  
  const greekMatches = [...text.matchAll(/\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|pi|phi|psi|omega)\b/gi)]
    .map(m => m[1].toLowerCase());
  
  greekMatches.forEach(g => vars.add(g));
  
  return Array.from(vars);
}

function extractInductionVariable(text) {
  const patterns = [
    /\binduction\s+on\s+([a-zA-Z])/i,
    /\bprove\s+by\s+induction\s+(?:that\s+)?.*\b([a-zA-Z])\b/i,
    /\bfor\s+all\s+([a-zA-Z])\s+in\s+ℕ/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function validateTree(tree) {
  const visited = new Set();
  const recursionStack = new Set();
  
  function hasCycle(nodeId) {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const node = [...tree.assumptions, ...tree.steps, tree.goal]
      .find(n => n && n.id === nodeId);
    
    if (node && node.dependsOn) {
      for (const dep of node.dependsOn) {
        if (hasCycle(dep)) return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }
  
  tree.steps.forEach(step => {
    if (hasCycle(step.id)) {
      console.warn(`Cycle detected in proof tree at step ${step.id}`);
      step.dependsOn = [];
    }
  });
  
  if (tree.goal && hasCycle(tree.goal.id)) {
    console.warn('Cycle detected in goal dependencies');
  }
}

export function getProofPath(tree) {
  return [...tree.assumptions, ...tree.steps, tree.goal].filter(n => n);
}

export function getDependencyGraph(tree) {
  const graph = {};
  
  const allNodes = [...tree.assumptions, ...tree.steps];
  if (tree.goal) allNodes.push(tree.goal);
  
  allNodes.forEach(node => {
    if (node && node.id) {
      graph[node.id] = node.dependsOn || [];
    }
  });
  
  return graph;
}