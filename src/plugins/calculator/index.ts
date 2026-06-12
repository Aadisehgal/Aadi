import type { Plugin, PluginResult } from '@apptypes/index';

const SAFE_MATH_PATTERN = /^[0-9+\-*/().\s%^MathsqrtlgoepiINFINITY]+$/;

function safeEvaluate(expression: string): string {
  const cleaned = expression.replace(/\^/g, '**');
  if (!SAFE_MATH_PATTERN.test(cleaned.replace(/Math\.\w+/g, 'Math'))) {
    throw new Error('Invalid expression: only math operations allowed');
  }
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    'Math',
    `"use strict"; return (${cleaned});`,
  );
  const result: unknown = fn(Math);
  if (typeof result !== 'number') throw new Error('Result is not a number');
  if (!isFinite(result)) return result > 0 ? 'Infinity' : result < 0 ? '-Infinity' : 'NaN';
  return String(result);
}

const calculatorPlugin: Plugin = {
  id: 'calculator',
  name: 'Calculator',
  description: 'Evaluate math expressions safely',
  execute: async (params): Promise<PluginResult> => {
    const expression = params.expression;
    if (typeof expression !== 'string' || !expression.trim()) {
      return { success: false, error: 'No expression provided' };
    }
    try {
      const result = safeEvaluate(expression.trim());
      return { success: true, data: `${expression} = ${result}` };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Calculation failed',
      };
    }
  },
};

export default calculatorPlugin;
