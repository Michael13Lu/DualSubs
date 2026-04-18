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

    const promise = this.dispatch(trimmed, settings)
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

  // ── Routing ───────────────────────────────────────────────────────────────

  private dispatch(text: string, settings: Settings): Promise<string> {
    // MyMemory is a free public API — fetch directly from the content script
    // to avoid MV3 service-worker lifecycle issues (worker sleeps mid-request).
    if (settings.translationProvider === 'mymemory') {
      return this.myMemoryDirect(text, settings.targetLanguage);
    }
    // Paid providers (Google / OpenAI) go through the background worker
    // so API keys stay out of the page context.
    return this.viaServiceWorker(text, settings);
  }

  // ── MyMemory: direct fetch from content script ────────────────────────────

  private async myMemoryDirect(text: string, targetLang: string): Promise<string> {
    const url =
      `https://api.mymemory.translated.net/get` +
      `?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);

    const data = await res.json();
    if (data.responseStatus !== 200) {
      throw new Error(`MyMemory: ${data.responseDetails}`);
    }
    return data.responseData.translatedText as string;
  }

  // ── Google / OpenAI: via background service worker ────────────────────────

  private viaServiceWorker(text: string, settings: Settings): Promise<string> {
    const payload = {
      text,
      sourceLang: 'en',
      targetLang: settings.targetLanguage,
      provider: settings.translationProvider,
      apiKey: settings.apiKey,
    };
    return this.sendWithRetry({ type: 'TRANSLATE', payload }, 3);
  }

  private sendWithRetry(message: object, attemptsLeft: number): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        message,
        (response: TranslationResponse | undefined) => {
          const err = chrome.runtime.lastError?.message ?? '';
          if (err) {
            const isRetriable =
              err.includes('Receiving end does not exist') ||
              err.includes('message port closed');

            if (attemptsLeft > 1 && isRetriable) {
              console.log(`[DualSubs] SW error (${err.slice(0, 40)}…), retry ${attemptsLeft - 1}`);
              setTimeout(
                () =>
                  this.sendWithRetry(message, attemptsLeft - 1)
                    .then(resolve)
                    .catch(reject),
                700
              );
            } else {
              reject(new Error(err));
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
