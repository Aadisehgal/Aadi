/**
 * Validates that a mathematical expression is safe to evaluate.
 * Allows: digits, arithmetic operators, parentheses, spaces, dots, Math functions.
 * Blocks: identifiers that aren't Math properties (no eval, no require, etc.)
 */
export function isValidExpression(expr: string): boolean {
  if (!expr || typeof expr !== 'string') return false;
  const trimmed = expr.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return false;

  // Allowed Math function names
  const mathFns = Object.getOwnPropertyNames(Math).join('|');
  // Remove all allowed tokens, then check nothing dangerous remains
  const stripped = trimmed
    .replace(/\d+\.?\d*/g, '')           // numbers
    .replace(/[+\-*/%(). ,^]/g, '')       // operators, parens, spaces
    .replace(new RegExp(`\\b(${mathFns})\\b`, 'g'), '') // Math functions
    .replace(/\bMath\b/g, '')             // Math object itself
    .trim();

  // If anything remains, it's not a safe expression
  return stripped.length === 0;
}

/**
 * Basic URL validator.
 */
export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * PIN validation: 4–8 digits.
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

/**
 * Package name validation: e.g. com.example.app
 */
export function isValidPackageName(pkg: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(pkg);
}

// ─── Prompt Injection Detection ───────────────────────────────────────────────

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /disregard\s+(your|all)\s+(previous\s+)?(instructions?|rules?|guidelines?)/i,
  /act\s+as\s+(if\s+you\s+are\s+)?a(n)?\s+/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode\s+enabled/i,
  /bypass\s+(your\s+)?(safety|filter|restriction)/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/,
  /system\s*:\s*you\s+are/i,
  /new\s+instructions?\s*:/i,
  /override\s+(previous\s+)?instructions?/i,
  /forget\s+(everything|all)\s+(above|before|you\s+were\s+told)/i,
];

/**
 * Returns true if the input appears to be a prompt injection attempt.
 */
export function isPromptInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Sanitise user input before sending to AI.
 * Strips injection attempts and returns cleaned text.
 */
export function sanitizeInput(input: string): { safe: boolean; sanitized: string } {
  const safe = !isPromptInjection(input);
  // Remove common injection markers even if not fully matched
  const sanitized = input
    .replace(/<\|im_start\|>|<\|im_end\|>/g, '')
    .replace(/\[INST\]|\[\/INST\]/g, '')
    .trim();
  return { safe, sanitized };
}
