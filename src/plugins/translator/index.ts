import { groqService } from '@services/groqService';
import type { Plugin, PluginResult } from '@apptypes/index';

function detectLanguage(text: string): string {
  const hindiRange = /[\u0900-\u097F]/;
  const arabicRange = /[\u0600-\u06FF]/;
  const chineseRange = /[\u4E00-\u9FFF]/;
  if (hindiRange.test(text)) return 'Hindi';
  if (arabicRange.test(text)) return 'Arabic';
  if (chineseRange.test(text)) return 'Chinese';
  return 'English';
}

const translatorPlugin: Plugin = {
  id: 'translator',
  name: 'Translator',
  description: 'Detect language and translate text via Groq',
  execute: async (params): Promise<PluginResult> => {
    const text = params.text as string;
    const targetLanguage = (params.targetLanguage as string) ?? 'English';

    if (!text?.trim()) return { success: false, error: 'No text provided' };

    const detectedLang = detectLanguage(text);

    try {
      const systemPrompt = `Translate the following text to ${targetLanguage}. Return ONLY the translation, nothing else.`;
      const translated = await groqService.complete(text, systemPrompt, 512);

      return {
        success: true,
        data: JSON.stringify({
          original: text,
          detectedLanguage: detectedLang,
          targetLanguage,
          translated: translated.trim(),
        }),
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Translation failed',
      };
    }
  },
};

export default translatorPlugin;
