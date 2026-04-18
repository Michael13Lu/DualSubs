import { PlatformAdapter, SubtitleCallback } from './baseAdapter';

export class YouTubeAdapter implements PlatformAdapter {
  readonly name = 'YouTube';

  private observer: MutationObserver | null = null;
  private callback: SubtitleCallback | null = null;
  private lastText = '';
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  matches(): boolean {
    return window.location.hostname === 'www.youtube.com';
  }

  start(callback: SubtitleCallback): void {
    this.callback = callback;
    this.tryAttach();

    // YouTube is an SPA — re-attach after each navigation
    window.addEventListener('yt-navigate-finish', this.onNavigate);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.callback = null;
    this.lastText = '';
    if (this.retryTimer) clearTimeout(this.retryTimer);
    window.removeEventListener('yt-navigate-finish', this.onNavigate);
  }

  private onNavigate = (): void => {
    this.observer?.disconnect();
    this.observer = null;
    this.lastText = '';
    this.tryAttach();
  };

  private tryAttach(): void {
    const container = document.querySelector('.ytp-caption-window-container');
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
    console.log('[DualSubs] YouTube subtitle observer attached');
  }

  private onMutation(): void {
    const segments = document.querySelectorAll('.ytp-caption-segment');
    const text = Array.from(segments)
      .map((el) => el.textContent?.trim())
      .filter(Boolean)
      .join(' ');

    if (text === this.lastText) return;
    this.lastText = text;
    this.callback?.(text);
  }
}
