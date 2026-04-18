export class TranslationCache {
  private readonly map = new Map<string, string>();
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get(text: string, lang: string): string | null {
    return this.map.get(this.key(text, lang)) ?? null;
  }

  set(text: string, lang: string, value: string): void {
    if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest) this.map.delete(oldest);
    }
    this.map.set(this.key(text, lang), value);
  }

  private key(text: string, lang: string): string {
    return `${lang}::${text}`;
  }
}
