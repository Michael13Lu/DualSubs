import { Message, TranslationRequest, TranslationResponse } from '../types';

// In-memory translation cache for the service worker session
const memCache = new Map<string, string>();

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (message.type === 'TRANSLATE') {
      handleTranslation(message.payload)
        .then(sendResponse)
        .catch((err: Error) =>
          sendResponse({ error: err.message } as TranslationResponse)
        );
      return true; // keep message channel open for async response
    }
    return false;
  }
);

async function handleTranslation(
  req: TranslationRequest
): Promise<TranslationResponse> {
  const key = cacheKey(req.text, req.targetLang);
  const cached = memCache.get(key);
  if (cached) return { translatedText: cached };

  const translatedText = await translate(req);
  memCache.set(key, translatedText);

  // Evict cache if it grows too large (keep last 1000 entries)
  if (memCache.size > 1000) {
    const firstKey = memCache.keys().next().value;
    if (firstKey) memCache.delete(firstKey);
  }

  return { translatedText };
}

async function translate(req: TranslationRequest): Promise<string> {
  switch (req.provider) {
    case 'google':
      return translateGoogle(req);
    case 'openai':
      return translateOpenAI(req);
    default:
      return translateMyMemory(req);
  }
}

async function translateMyMemory(req: TranslationRequest): Promise<string> {
  // MyMemory rejects 'auto' — use 'en' as default source language
  const source = !req.sourceLang || req.sourceLang === 'auto' ? 'en' : req.sourceLang;
  const langPair = `${source}|${req.targetLang}`;
  const url =
    `https://api.mymemory.translated.net/get` +
    `?q=${encodeURIComponent(req.text)}&langpair=${langPair}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);

  const data = await res.json();
  if (data.responseStatus !== 200) {
    throw new Error(`MyMemory: ${data.responseDetails}`);
  }
  return data.responseData.translatedText as string;
}

async function translateGoogle(req: TranslationRequest): Promise<string> {
  if (!req.apiKey) throw new Error('Google Translate API key is required');

  const url = `https://translation.googleapis.com/language/translate/v2?key=${req.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: req.text,
      source: req.sourceLang === 'auto' ? undefined : req.sourceLang,
      target: req.targetLang,
      format: 'text',
    }),
  });
  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);

  const data = await res.json();
  return data.data.translations[0].translatedText as string;
}

async function translateOpenAI(req: TranslationRequest): Promise<string> {
  if (!req.apiKey) throw new Error('OpenAI API key is required');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Translate the following subtitle text to ${req.targetLang}. Return only the translation, nothing else.`,
        },
        { role: 'user', content: req.text },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);

  const data = await res.json();
  return (data.choices[0].message.content as string).trim();
}

function cacheKey(text: string, lang: string): string {
  return `${lang}::${text}`;
}
