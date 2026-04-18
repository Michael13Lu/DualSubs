import { Settings, TranslationResponse } from '../../types';
import { TranslationCache } from '../utils/cache';

export class TranslationService {
  private readonly cache = new TranslationCache();
  private readonly inFlight = new Map<string, Promise<string>>();

  async translate(text: string, settings: Settings): Promise<string | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const cached = this.cache.get(trimmed, settings.targetLanguage);
    if (cached !== null) return cached;

    const key = `${settings.targetLanguage}::${trimmed}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = this.request(trimmed, settings)
      .then((result) => {
        this.cache.set(trimmed, settings.targetLanguage, result);
        this.inFlight.delete(key);
        return result;
      })
      .catch((err) => {
        this.inFlight.delete(key);
        console.error('[DualSubs] Translation failed:', err);
        return '';
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  private request(text: string, settings: Settings): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'TRANSLATE',
          payload: {
            text,
            sourceLang: 'auto',
            targetLang: settings.targetLanguage,
            provider: settings.translationProvider,
            apiKey: settings.apiKey,
          },
        },
        (response: TranslationResponse | undefined) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response || response.error) {
            reject(new Error(response?.error ?? 'No response'));
            return;
          }
          resolve(response.translatedText);
        }
      );
    });
  }
}
