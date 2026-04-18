import { PlatformAdapter, SubtitleCallback } from './baseAdapter';

// Udemy renders captions in TWO possible ways:
// 1. Native HTML5 TextTrack (caught via cuechange events)
// 2. A React component OUTSIDE the <video> element (below the player controls)
// We try both and keep both active.

export class UdemyAdapter implements PlatformAdapter {
  readonly name = 'Udemy';

  private callback: SubtitleCallback | null = null;
  private lastText = '';
  private cleanups: Array<() => void> = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private domAttached = false;
  private tracksAttached = false;

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
    this.domAttached = false;
    this.tracksAttached = false;
  }

  private tryAttach(): void {
    if (!this.tracksAttached) this.tracksAttached = this.attachTextTracks();
    if (!this.domAttached) this.domAttached = this.attachDOMObserver();

    if (!this.tracksAttached && !this.domAttached) {
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

    // Always watch for tracks added later
    const onAdd = (e: Event) => {
      const track = (e as TrackEvent).track;
      if (track) this.bindTrack(track);
    };
    video.textTracks.addEventListener('addtrack', onAdd);
    this.cleanups.push(() =>
      video.textTracks.removeEventListener('addtrack', onAdd)
    );

    const tracks = Array.from(video.textTracks);
    tracks.forEach((t) => this.bindTrack(t));

    if (tracks.length > 0) {
      console.log(`[DualSubs] Udemy TextTrack attached (${tracks.length} track(s))`);
      return true;
    }

    // Video found but no tracks yet — report progress but keep retrying
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

  // ── Strategy 2: DOM MutationObserver ─────────────────────────────────────
  //
  // Udemy places captions in a React component OUTSIDE the video element.
  // We observe the closest stable ancestor of the player area.

  private attachDOMObserver(): boolean {
    const container = this.findContainer();
    if (!container) return false;

    const observer = new MutationObserver(() => this.onDOMMutation());
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    this.cleanups.push(() => observer.disconnect());
    console.log('[DualSubs] Udemy DOM observer on:', container.tagName, container.className.slice(0, 60));
    return true;
  }

  private findContainer(): Element | null {
    // Ordered from most specific to broadest
    const selectors = [
      // Stable data-purpose attributes (Udemy's own API surface)
      '[data-purpose="captions-display"]',
      '[data-purpose="video-component"]',
      '[data-purpose="video-player"]',
      // video.js internals
      '.vjs-text-track-display',
      // Hashed class fragments (fragile but worth trying)
      '[class*="captions-display"]',
      '[class*="caption-display"]',
      // Broad fallback: the video player root
      '[class*="video-viewer"]',
      '[class*="lecture-viewer"]',
      '[class*="player-container"]',
      // Last resort: parent of <video>
      ...[document.querySelector('video')?.parentElement].filter(Boolean) as Element[],
    ];

    return selectors.map((s) =>
      typeof s === 'string' ? document.querySelector(s) : s
    ).find(Boolean) ?? null;
  }

  private onDOMMutation(): void {
    const cueSelectors = [
      '[data-purpose="captions-cue-text"]',
      '[data-purpose="transcript-cue"]',
      '.vjs-text-track-cue span',
      '.vjs-text-track-cue',
      '[class*="captions-cue-text"]',
      '[class*="caption-cue-text"]',
    ];
    const el = cueSelectors
      .map((s) => document.querySelector(s))
      .find(Boolean);

    this.emit(el?.textContent?.trim() ?? '');
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  private emit(text: string): void {
    if (text === this.lastText) return;
    this.lastText = text;
    console.log('[DualSubs] Udemy subtitle:', text || '(cleared)');
    this.callback?.(text);
  }
}
