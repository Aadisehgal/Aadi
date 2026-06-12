import type { CuteMode } from '@apptypes/index';

const GREETING_KEYWORDS = ['hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon'];
const CONFIRMATION_KEYWORDS = ['done', 'sure', 'okay', 'yes', 'confirmed', 'alright', 'got it'];
const ERROR_KEYWORDS = ['error', 'failed', 'sorry', 'cannot', "can't", 'unable', 'oops'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isGreeting(text: string): boolean {
  const lower = text.toLowerCase();
  return GREETING_KEYWORDS.some((kw) => lower.startsWith(kw));
}

function isConfirmation(text: string): boolean {
  const lower = text.toLowerCase();
  return CONFIRMATION_KEYWORDS.some((kw) => lower.includes(kw));
}

function isError(text: string): boolean {
  const lower = text.toLowerCase();
  return ERROR_KEYWORDS.some((kw) => lower.includes(kw));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

function firstSentence(text: string): string {
  const match = text.match(/[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 80).trim();
}

export function transformForTTS(text: string, mode: CuteMode): string {
  if (mode === 'off') return text;

  const wc = wordCount(text);

  if (mode === 'mild') {
    if (isError(text)) return `Uh oh... ${text}`;
    if (isGreeting(text)) return text.replace(/^(hello|hi|hey|good \w+)/i, 'Haii~!');
    if (isConfirmation(text)) return `${text} Okie~!`;
    if (wc < 20) return `Hmm~ ${text}`;
    return text;
  }

  // full
  if (wc > 60) {
    return `${firstSentence(text)}...nya~`;
  }
  if (isError(text)) {
    return `${pickRandom(['Uh oh... sowwy~', 'Oopsie~'])} ${text}`;
  }
  if (isGreeting(text)) {
    const opener = pickRandom(['Haii~!', 'Hewwo!', 'Yoohoo~!']);
    return text.replace(/^(hello|hi|hey|good \w+)/i, opener);
  }
  if (isConfirmation(text)) {
    return `${text} ${pickRandom(['Okie dokie~!', 'Roger that, nya~!'])}`;
  }
  if (wc < 20) {
    return `${pickRandom(['Hmm~', 'Ooh!', 'Teehee~'])} ${text}`;
  }
  return text;
}

export const CuteLanguageModule = { transformForTTS };
