export interface Settings {
  enabled: boolean;
  targetLanguage: string;
  showOriginal: boolean;
  position: 'top' | 'bottom';
  fontSize: number;
  fontColor: string;
  bgColor: string;
  bgOpacity: number;
  spacing: number;
  translationProvider: 'mymemory' | 'google' | 'openai';
  apiKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  targetLanguage: 'ru',
  showOriginal: true,
  position: 'bottom',
  fontSize: 18,
  fontColor: '#ffffff',
  bgColor: '#000000',
  bgOpacity: 0.75,
  spacing: 8,
  translationProvider: 'mymemory',
  apiKey: '',
};

export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  provider: 'mymemory' | 'google' | 'openai';
  apiKey?: string;
}

export interface TranslationResponse {
  translatedText: string;
  error?: string;
}

export type Message =
  | { type: 'TRANSLATE'; payload: TranslationRequest };
