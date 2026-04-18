import { PlatformAdapter, SubtitleCallback } from './baseAdapter';

export class UdemyAdapter implements PlatformAdapter {
  readonly name = 'Udemy';

  private observer: MutationObserver | null = null;
  private callback: SubtitleCallback | null = null;
  private lastText = '';
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  matches(): boolean {
    return window.location.hostname === 'www.udemy.com';
  }

  start(callback: SubtitleCallback): void {
    this.callback = callback;
    this.tryAttach();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.callback = null;
    this.lastText = '';
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  private tryAttach(): void {
    // Udemy uses video.js — try multiple known selectors
    const container =
      document.querySelector('.vjs-text-track-display') ??
      document.querySelector('[data-purpose="captions-cue-text"]')
        ?.parentElement?.parentElement;

    if (container) {
      this.attachObserver(container);
    } else {
      this.retryTimer = setTimeout(() => this.tryAttach(), 1000);
    }
  }

  private attachObserver(container: Element): void {
    this.observer = new MutationObserver(() => this.onMutation());
    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    console.log('[DualSubs] Udemy subtitle observer attached');
  }

  private onMutation(): void {
    const cue =
      document.querySelector('[data-purpose="captions-cue-text"]') ??
      document.querySelector('.vjs-text-track-cue span');

    const text = cue?.textContent?.trim() ?? '';
    if (text === this.lastText) return;
    this.lastText = text;
    this.callback?.(text);
  }
}
