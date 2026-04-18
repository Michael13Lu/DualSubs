import { PlatformAdapter, SubtitleCallback } from './baseAdapter';

export class UdemyAdapter implements PlatformAdapter {
  readonly name = 'Udemy';

  private callback: SubtitleCallback | null = null;
  private lastText = '';
  private cleanups: Array<() => void> = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private tracksAttached = false;
  private domAttached = false;
  private observedContainer: Element | null = null;

  matches(): boolean {
    return window.location.hostname === 'www.udemy.com';
  }

  start(callback: SubtitleCallback): void {
    this.callback = callback;
    this.tryAttach();
  }

  stop(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.callback = null;
    this.lastText = '';
    this.retryCount = 0;
    this.tracksAttached = false;
    this.domAttached = false;
    this.observedContainer = null;
  }

  private tryAttach(): void {
    if (!this.tracksAttached) this.tracksAttached = this.attachTextTracks();
    if (!this.domAttached)    this.domAttached    = this.attachDOMObserver();

    if (!this.domAttached) {
      this.retryCount++;
      const delay = Math.min(1000 * this.retryCount, 4000);
      console.log(`[DualSubs] Udemy – waiting for player (attempt ${this.retryCount})`);
      this.retryTimer = setTimeout(() => this.tryAttach(), delay);
    }
  }

  // ── Strategy 1: HTML5 TextTrack API ──────────────────────────────────────

  private attachTextTracks(): boolean {
    const video = document.querySelector('video');
    if (!video) return false;

    const onAdd = (e: Event) => {
      const t = (e as TrackEvent).track;
      if (t) this.bindTrack(t);
    };
    video.textTracks.addEventListener('addtrack', onAdd);
    this.cleanups.push(() => video.textTracks.removeEventListener('addtrack', onAdd));

    const tracks = Array.from(video.textTracks);
    tracks.forEach((t) => this.bindTrack(t));

    if (tracks.length > 0) {
      console.log(`[DualSubs] Udemy TextTrack attached (${tracks.length} track(s))`);
      return true;
    }

    console.log('[DualSubs] Udemy <video> found, no TextTracks yet');
    return false;
  }

  private bindTrack(track: TextTrack): void {
    if (track.kind !== 'subtitles' && track.kind !== 'captions') return;
    if (track.mode === 'disabled') track.mode = 'hidden';
    const handler = () => this.onCueChange(track);
    track.addEventListener('cuechange', handler);
    this.cleanups.push(() => track.removeEventListener('cuechange', handler));
    console.log(`[DualSubs] Udemy bound track: ${track.label || track.language}`);
  }

  private onCueChange(track: TextTrack): void {
    if (!track.activeCues || track.activeCues.length === 0) { this.emit(''); return; }
    const text = Array.from(track.activeCues)
      .map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean).join(' ');
    this.emit(text);
  }

  // ── Strategy 2: DOM MutationObserver ─────────────────────────────────────

  private attachDOMObserver(): boolean {
    const container = this.findContainer();
    if (!container) return false;

    this.observedContainer = container;
    const observer = new MutationObserver((muts) => this.onDOMMutation(muts));
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    this.cleanups.push(() => observer.disconnect());

    // Log found container class for debugging
    const cls = (container as HTMLElement).className?.toString().slice(0, 80) ?? '';
    console.log(`[DualSubs] Udemy DOM observer on: ${container.tagName} ${cls}`);
    return true;
  }

  private findContainer(): Element | null {
    const candidates = [
      // Stable data-purpose attributes
      '[data-purpose="captions-display"]',
      '[data-purpose="video-component"]',
      '[data-purpose="video-player"]',
      // video.js
      '.vjs-text-track-display',
      // Hashed class fragments (Udemy's pattern: ComponentName--elementName--hash)
      '[class*="video-viewer--container"]',
      '[class*="captions-display"]',
      '[class*="caption-display"]',
      '[class*="video-viewer"]',
      '[class*="lecture-view"]',
    ];

    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // Last resort: parent of the <video> element, two levels up
    const video = document.querySelector('video');
    return video?.parentElement?.parentElement ?? video?.parentElement ?? null;
  }

  private onDOMMutation(mutations: MutationRecord[]): void {
    // 1. Try known selectors first
    const known = [
      '[data-purpose="captions-cue-text"]',
      '[data-purpose="transcript-cue"]',
      '[class*="captions-cue-text"]',
      '[class*="caption-cue-text"]',
      '[class*="video-viewer--captions"]',
      '[class*="captions-container"]',
      '.vjs-text-track-cue span',
      '.vjs-text-track-cue',
    ];

    for (const sel of known) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text) { this.emit(text); return; }
    }

    // 2. Fallback: scan added/changed nodes for subtitle-length text
    //    (subtitles are sentences, not short time codes or numbers)
    for (const mut of mutations) {
      for (const node of Array.from(mut.addedNodes)) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (this.looksLikeSubtitle(text)) {
          this.emit(text);
          return;
        }
      }
      if (mut.type === 'characterData') {
        const text = mut.target.textContent?.trim() ?? '';
        if (this.looksLikeSubtitle(text)) {
          this.emit(text);
          return;
        }
      }
    }
  }

  /** Subtitle text is typically 10–300 chars of words, not numbers/symbols */
  private looksLikeSubtitle(text: string): boolean {
    if (text.length < 8 || text.length > 400) return false;
    const wordChars = text.replace(/[^a-zA-ZА-Яа-яёÀ-ÿ\s]/g, '').length;
    return wordChars / text.length > 0.6;
  }

  private emit(text: string): void {
    if (text === this.lastText) return;
    this.lastText = text;
    console.log('[DualSubs] Udemy subtitle:', text || '(cleared)');
    this.callback?.(text);
  }
}
