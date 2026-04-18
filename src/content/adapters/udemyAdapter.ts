import { PlatformAdapter, SubtitleCallback } from './baseAdapter';

// Udemy uses video.js. Subtitles can be either:
// 1. Native HTML5 TextTrack (most reliable — catches cue changes via API)
// 2. video.js DOM overlay (.vjs-text-track-display) as fallback

export class UdemyAdapter implements PlatformAdapter {
  readonly name = 'Udemy';

  private callback: SubtitleCallback | null = null;
  private lastText = '';
  private cleanups: Array<() => void> = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;

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
  }

  private tryAttach(): void {
    // Strategy 1: native HTML5 TextTrack API
    const textTrackOk = this.attachTextTracks();

    // Strategy 2: video.js DOM observer (fallback / supplement)
    const domOk = this.attachDOMObserver();

    if (!textTrackOk && !domOk) {
      this.retryCount++;
      const delay = Math.min(1000 * this.retryCount, 5000);
      console.debug(`[DualSubs] Udemy – nothing found yet, retry in ${delay}ms`);
      this.retryTimer = setTimeout(() => this.tryAttach(), delay);
    }
  }

  // ── Strategy 1: HTML5 TextTrack API ──────────────────────────────────────

  private attachTextTracks(): boolean {
    const video = document.querySelector('video');
    if (!video) return false;

    const tracks = Array.from(video.textTracks);
    if (tracks.length === 0) return false;

    tracks.forEach((track) => this.bindTrack(track));

    // Watch for tracks added later (e.g. user switches language)
    const onAdd = (e: Event) => {
      const track = (e as TrackEvent).track;
      if (track) this.bindTrack(track);
    };
    video.textTracks.addEventListener('addtrack', onAdd);
    this.cleanups.push(() =>
      video.textTracks.removeEventListener('addtrack', onAdd)
    );

    console.log(`[DualSubs] Udemy TextTrack attached (${tracks.length} track(s))`);
    return true;
  }

  private bindTrack(track: TextTrack): void {
    // Need mode != 'disabled' for cuechange events to fire.
    // If Udemy already shows them ('showing'), leave it alone.
    // Otherwise use 'hidden' so we get events without visible rendering.
    if (track.kind === 'subtitles' || track.kind === 'captions') {
      if (track.mode === 'disabled') track.mode = 'hidden';

      const handler = () => this.onCueChange(track);
      track.addEventListener('cuechange', handler);
      this.cleanups.push(() => track.removeEventListener('cuechange', handler));
    }
  }

  private onCueChange(track: TextTrack): void {
    if (!track.activeCues || track.activeCues.length === 0) {
      this.emit('');
      return;
    }
    const text = Array.from(track.activeCues)
      .map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .join(' ');
    this.emit(text);
  }

  // ── Strategy 2: video.js DOM observer ────────────────────────────────────

  private attachDOMObserver(): boolean {
    // Try every selector Udemy has used across versions
    const containerSelectors = [
      '.vjs-text-track-display',
      '[data-purpose="captions-display"]',
      '[data-purpose="video-component"]',
    ];
    const container = containerSelectors
      .map((s) => document.querySelector(s))
      .find(Boolean);

    if (!container) return false;

    const observer = new MutationObserver(() => this.onDOMMutation());
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    this.cleanups.push(() => observer.disconnect());
    console.log('[DualSubs] Udemy DOM observer attached on', container.className);
    return true;
  }

  private onDOMMutation(): void {
    const cueSelectors = [
      '[data-purpose="captions-cue-text"]',
      '.vjs-text-track-cue span',
      '.vjs-text-track-cue',
      // Older Udemy class names (hashed)
      '[class*="captions-cue"]',
      '[class*="caption-cue"]',
    ];
    const el = cueSelectors.map((s) => document.querySelector(s)).find(Boolean);
    this.emit(el?.textContent?.trim() ?? '');
  }

  // ── Shared emit ───────────────────────────────────────────────────────────

  private emit(text: string): void {
    if (text === this.lastText) return;
    this.lastText = text;
    console.debug('[DualSubs] Udemy subtitle:', text || '(cleared)');
    this.callback?.(text);
  }
}
