import { PlatformAdapter, SubtitleCallback } from './baseAdapter';

// Udemy renders the subtitle text OUTSIDE the <video> element,
// in a sibling component below the player controls.
// We observe the parent of the video viewer to catch it.

export class UdemyAdapter implements PlatformAdapter {
  readonly name = 'Udemy';

  private callback: SubtitleCallback | null = null;
  private lastText = '';
  private cleanups: Array<() => void> = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private tracksAttached = false;
  private domAttached = false;

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

    const observer = new MutationObserver(() => this.onDOMMutation());
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    this.cleanups.push(() => observer.disconnect());

    const tag = container.tagName;
    const cls = (container as HTMLElement).className?.toString().slice(0, 80) ?? '';
    console.log(`[DualSubs] Udemy DOM observer on: ${tag} "${cls}"`);
    return true;
  }

  private findContainer(): Element | null {
    // The subtitle is OUTSIDE the video player — observe the player's parent
    const playerSelectors = [
      '[class*="video-viewer--container"]',
      '[data-purpose="video-component"]',
      '[data-purpose="video-player"]',
      '.vjs-tech',
    ];

    for (const sel of playerSelectors) {
      const el = document.querySelector(sel);
      if (el?.parentElement) {
        console.log(`[DualSubs] Using parent of "${sel}" as watch container`);
        return el.parentElement;
      }
    }

    // Fallback: two levels above <video>
    const video = document.querySelector('video');
    return video?.parentElement?.parentElement
      ?? video?.parentElement
      ?? null;
  }

  private onDOMMutation(): void {
    // 1. Check known stable selectors first
    const knownSelectors = [
      '[data-purpose="captions-cue-text"]',
      '[data-purpose="transcript-cue"]',
      '[class*="captions-cue-text"]',
      '[class*="caption-cue"]',
      '[class*="video-viewer--captions"]',
      '.vjs-text-track-cue span',
      '.vjs-text-track-cue',
    ];

    for (const sel of knownSelectors) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text) {
        this.emit(text);
        return;
      }
    }

    // 2. Scan all elements near the bottom of the player area
    //    that contain sentence-length text (not progress % or time codes)
    const allEls = document.querySelectorAll(
      '[class*="video-viewer"] p, [class*="video-viewer"] span, ' +
      '[class*="captions"] p, [class*="captions"] span, ' +
      '[class*="caption"] p, [class*="caption"] span'
    );

    for (const el of Array.from(allEls)) {
      const text = el.textContent?.trim() ?? '';
      if (this.looksLikeSubtitle(text)) {
        this.emit(text);
        return;
      }
    }
  }

  /** Subtitle text: 10-400 chars, >65% word characters, no UI noise patterns */
  private looksLikeSubtitle(text: string): boolean {
    if (text.length < 10 || text.length > 400) return false;
    if (/^Progress bar/i.test(text)) return false;
    if (/^\d{1,2}:\d{2}/.test(text)) return false;          // time codes
    if (/\[Auto\]/i.test(text)) return false;               // "English [Auto], Dutch [Auto]"
    if (/^\s*[\w\s]+\[.*?\](,\s*[\w\s]+\[.*?\])*\s*$/.test(text)) return false; // language labels
    if (/Loaded:\s*\d*%?/i.test(text)) return false;        // "Loaded: NaN%"
    if (/^\s*\d+(\.\d+)?%\s*$/.test(text)) return false;   // bare percentage
    if (text.replace(/\d|[%.:,\s]/g, '').length < 3) return false;
    const letters = (text.match(/[a-zA-ZА-Яа-яёÀ-ÿ]/g) ?? []).length;
    return letters / text.length > 0.60;
  }

  private emit(text: string): void {
    if (text === this.lastText) return;
    this.lastText = text;
    console.log('[DualSubs] Udemy subtitle:', text || '(cleared)');
    this.callback?.(text);
  }
}
