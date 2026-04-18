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
    const payload = {
      text,
      sourceLang: 'en',
      targetLang: settings.targetLanguage,
      provider: settings.translationProvider,
      apiKey: settings.apiKey,
    };

    // MV3 service workers can go idle and drop the first message.
    // Retry once after a short delay so the worker has time to wake up.
    return this.sendWithRetry({ type: 'TRANSLATE', payload }, 2);
  }

  private sendWithRetry(
    message: object,
    attemptsLeft: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        message,
        (response: TranslationResponse | undefined) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message ?? '';
            if (attemptsLeft > 1 && msg.includes('Receiving end does not exist')) {
              console.log('[DualSubs] Service worker inactive, retrying…');
              setTimeout(
                () => this.sendWithRetry(message, attemptsLeft - 1).then(resolve).catch(reject),
                600
              );
            } else {
              reject(new Error(msg));
            }
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
