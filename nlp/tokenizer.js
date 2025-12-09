// nlp/tokenizer.js
import nlp from 'compromise';

export function tokenizeSentences(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return [];
  }

  try {
    const doc = nlp(text);
    const sentences = doc.sentences().out('array');
    
    return sentences
      .filter(s => s && s.trim())
      .map(s => classifySentence(s));
  } catch (err) {
    console.error('Tokenization error:', err);
    return [];
  }
}

function classifySentence(sentence) {
  const text = sentence.trim();
  const lower = text.toLowerCase();
  
  if (/\b(by|using|via)\s+induction(\s+on)?/i.test(lower) || 
      /\bprove\s+by\s+induction/i.test(lower) ||
      /\binductive\s+(step|case|hypothesis)/i.test(lower)) {
    return { type: 'induction', text };
  }
  
  if (/\b(suppose|assume)\s+(not|that.*not)/i.test(lower) ||
      /\b(contradiction|contradicts|absurd)/i.test(lower) ||
      /\blead(s)?\s+to\s+a\s+contradiction/i.test(lower)) {
    return { type: 'contradiction', text };
  }
  
  if (/\b(consider|examine)\s+the\s+case/i.test(lower) ||
      /\bcase\s+\d+/i.test(lower) ||
      /\bin\s+the\s+case\s+(where|when)/i.test(lower) ||
      /\b(first|second|next)\s+case/i.test(lower)) {
    return { type: 'case', text };
  }
  
  if (/\bby\s+definition(\s+of)?/i.test(lower) ||
      /\bdefinition\s+of/i.test(lower) ||
      /\bsimplif(y|ying|ies)/i.test(lower) ||
      /\bexpand(ing)?\s+(the|this)/i.test(lower) ||
      /\bsubstitut(e|ing)/i.test(lower)) {
    return { type: 'definition', text };
  }
  
  if (/\bthere\s+exists?/i.test(lower) ||
      /\bfor\s+some/i.test(lower) ||
      /\bwe\s+can\s+find/i.test(lower) ||
      /\bchoose/i.test(lower) ||
      /∃/.test(text)) {
    return { type: 'existential', text };
  }
  
  if (/\bfor\s+(all|every|each|any)/i.test(lower) ||
      /\bevery\s+\w+\s+(is|has|satisfies)/i.test(lower) ||
      /∀/.test(text)) {
    return { type: 'universal', text };
  }
  
  if (/\bif\b.*\bthen\b/i.test(lower) ||
      /\bwhenever\b.*\b(then|we have)/i.test(lower) ||
      /\bimplies?\b/i.test(lower) ||
      /→|⇒|⟹/.test(text)) {
    return { type: 'implication', text };
  }
  
  if (/^(assume|suppose|let|given)\b/i.test(lower) ||
      /\bwe\s+(assume|suppose|let)/i.test(lower)) {
    return { type: 'assumption', text };
  }
  
  if (/^(then|thus|so|hence)\b/i.test(lower) ||
      /\bwe\s+(have|get|obtain|derive|see|find|conclude)/i.test(lower) ||
      /\bthis\s+(gives|yields|shows|implies)/i.test(lower) ||
      /\bit\s+follows\s+that/i.test(lower)) {
    return { type: 'step', text };
  }
  
  if (/^(therefore|hence|thus|consequently|so)\b/i.test(lower) ||
      /\bwe\s+conclude\s+that/i.test(lower) ||
      /\bthis\s+(proves|establishes|shows|demonstrates)/i.test(lower) ||
      /\bQ\.?E\.?D\.?/i.test(text) ||
      /∎/.test(text)) {
    return { type: 'conclusion', text };
  }
  
  if (/\b(divisible|divides|factor|multiple)\b/i.test(lower) ||
      /\b(even|odd|prime|composite)\b/i.test(lower) ||
      /\b(integer|rational|irrational|real|natural)\s+number/i.test(lower) ||
      /\d+\s*[+\-*/]\s*\d+/.test(text) ||
      /\b(gcd|lcm|mod|remainder)\b/i.test(lower)) {
    return { type: 'arithmetic', text };
  }
  
  if (/[a-z]\s*[=<>≤≥≠]\s*[a-z0-9]/i.test(text) ||
      /\bequation\b/i.test(lower) ||
      /\bsolve\s+for/i.test(lower)) {
    return { type: 'algebraic', text };
  }
  
  if (/\b(subset|superset|element|belongs\s+to|contained\s+in)\b/i.test(lower) ||
      /\b(union|intersection|complement|empty\s+set)\b/i.test(lower) ||
      /[∈∉⊂⊃∪∩∅]/.test(text)) {
    return { type: 'set_theory', text };
  }
  
  return { type: 'other', text };
}