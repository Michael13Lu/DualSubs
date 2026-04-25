import { Settings } from '../../types';

const OVERLAY_ID = 'dualsubs-overlay';
const HIDE_STYLE_ID = 'dualsubs-hide-native';

// Selectors for Udemy's native subtitle elements — we hide them and
// replace them with our own dual-line overlay.
const UDEMY_CAPTION_SELECTORS = [
  // Udemy's "well" subtitle bar (below the video player)
  '[class*="well--container"]',
  '[class*="well--text"]',
  // Legacy / alternative selectors
  '[data-purpose="captions-cue-text"]',
  '[data-purpose="captions-display"]',
  '[data-purpose="transcript-cue"]',
  '[class*="captions-cue-text"]',
  '[class*="captions-cue"]',
  '[class*="caption-cue"]',
  '[class*="captions-container"]',
  '[class*="captions-display"]',
  '[class*="video-viewer--captions"]',
  '.vjs-text-track-display .vjs-text-track-cue',
  '.vjs-text-track-display .vjs-text-track-cue > div',
  '.vjs-text-track-display',
].join(',');

// Selectors for Udemy's below-video caption bar — used to anchor our overlay
// to the same position. Must match the container (not text-only) element.
const UDEMY_BELOW_VIDEO_SELECTORS = [
  '[class*="well--container"]',
  '[data-purpose="captions-display"]',
  '[class*="captions-display"]',
  '[class*="video-viewer--captions"]',
];

export class UIOverlayService {
  private container: HTMLDivElement | null = null;
  private originalEl: HTMLDivElement | null = null;
  private translatedEl: HTMLDivElement | null = null;
  private playerEl: HTMLElement | null = null;
  private positionCleanup: (() => void) | null = null;

  private get isUdemy(): boolean {
    return window.location.hostname.includes('udemy.com');
  }

  show(originalText: string, translatedText: string, settings: Settings): void {
    this.ensureContainer(settings);
    if (!this.container) return;

    this.container.style.display = 'flex';

    if (this.originalEl) {
      const showOrig = settings.showOriginal;
      this.originalEl.textContent = originalText;
      this.originalEl.style.display = showOrig ? '' : 'none';
    }
    if (this.translatedEl) {
      this.translatedEl.textContent = translatedText;
    }

    if (this.isUdemy) {
      this.refreshUdemyPosition();
      // Re-apply hiding each update — Udemy may re-render captions dynamically
      this.forceHideUdemyCaptions();
    }
  }

  clear(): void {
    if (!this.container) return;
    this.container.style.display = 'none';
    if (this.originalEl) this.originalEl.textContent = '';
    if (this.translatedEl) this.translatedEl.textContent = '';
  }

  destroy(): void {
    this.positionCleanup?.();
    this.positionCleanup = null;
    this.container?.remove();
    this.container = null;
    this.originalEl = null;
    this.translatedEl = null;
    if (this.playerEl && this.playerEl.dataset['dualsubsPos']) {
      this.playerEl.style.position = this.playerEl.dataset['dualsubsPos'];
      delete this.playerEl.dataset['dualsubsPos'];
    }
    this.playerEl = null;
    // Restore Udemy's native subtitles
    document.getElementById(HIDE_STYLE_ID)?.remove();
  }

  applySettings(settings: Settings): void {
    if (!this.container) return;
    if (!this.isUdemy) this.applyPositionStyles(settings);
    this.applyLineStyles(settings);
    this.container.style.gap = `${settings.spacing}px`;
  }

  // ── Container bootstrap ───────────────────────────────────────────────────

  private ensureContainer(settings: Settings): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = OVERLAY_ID;

    this.originalEl = document.createElement('div');
    this.originalEl.className = 'dualsubs-original';

    this.translatedEl = document.createElement('div');
    this.translatedEl.className = 'dualsubs-translated';

    this.container.appendChild(this.originalEl);
    this.container.appendChild(this.translatedEl);

    if (this.isUdemy) {
      this.hideUdemyNativeSubtitles();
      this.mountUdemy(settings);
    } else {
      this.mountInPlayer(settings);
    }
  }

  // ── Udemy: hide native subs, show our overlay inside the video ────────────

  private hideUdemyNativeSubtitles(): void {
    if (document.getElementById(HIDE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = HIDE_STYLE_ID;
    style.textContent = `${UDEMY_CAPTION_SELECTORS} { opacity: 0 !important; visibility: hidden !important; }`;
    document.head.appendChild(style);
    // Belt-and-suspenders: directly set styles in case CSS is overridden
    this.forceHideUdemyCaptions();
  }

  private forceHideUdemyCaptions(): void {
    UDEMY_CAPTION_SELECTORS.split(',').forEach(sel => {
      document.querySelectorAll<HTMLElement>(sel.trim()).forEach(el => {
        if (el.id === OVERLAY_ID) return;
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
      });
    });
  }

  private mountUdemy(settings: Settings): void {
    const controlBar = document.querySelector<HTMLElement>('[data-purpose="video-controls"]');
    // control-bar → control-bar-container → shaka-video-container
    const controlBarContainer = controlBar?.parentElement ?? null;
    const shakaContainer =
      controlBarContainer?.parentElement ??
      controlBar?.closest<HTMLElement>('[id*="shaka-video-container"]') ??
      null;

    if (shakaContainer) {
      // Mount inside the Shaka video container — it wraps the entire player.
      // Our overlay sits above the controls via position:absolute + bottom offset.
      const pos = window.getComputedStyle(shakaContainer).position;
      if (pos === 'static') {
        shakaContainer.dataset['dualsubsPos'] = 'static';
        shakaContainer.style.position = 'relative';
      }
      shakaContainer.appendChild(this.container!);
      this.playerEl = shakaContainer;
      this.applyUdemyInVideoBaseStyles(settings);
      this.updateUdemyInVideoBottom(controlBarContainer);

      const onResize    = () => this.updateUdemyInVideoBottom(controlBarContainer);
      const onFullscreen = () => this.onFullscreenChange(settings);
      window.addEventListener('resize', onResize, { passive: true });
      document.addEventListener('fullscreenchange', onFullscreen);
      this.positionCleanup = () => {
        window.removeEventListener('resize', onResize);
        document.removeEventListener('fullscreenchange', onFullscreen);
      };
    } else {
      // Fallback: position:fixed on body
      this.applyUdemyBaseStyles(settings);
      document.body.appendChild(this.container!);
      this.refreshUdemyPosition();

      const onScrollResize = () => this.refreshUdemyPosition();
      const onFullscreen   = () => this.onFullscreenChange(settings);
      window.addEventListener('scroll', onScrollResize, { passive: true });
      window.addEventListener('resize', onScrollResize, { passive: true });
      document.addEventListener('fullscreenchange', onFullscreen);
      this.positionCleanup = () => {
        window.removeEventListener('scroll', onScrollResize);
        window.removeEventListener('resize', onScrollResize);
        document.removeEventListener('fullscreenchange', onFullscreen);
      };
    }

    this.applyLineStyles(settings);
  }

  // Base styles for in-video mounting (position:absolute inside shaka container).
  private applyUdemyInVideoBaseStyles(settings: Settings): void {
    Object.assign(this.container!.style, {
      position:      'absolute',
      left:          '50%',
      transform:     'translateX(-50%)',
      top:           'auto',
      zIndex:        '2147483647',
      pointerEvents: 'none',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           `${settings.spacing}px`,
      width:         'max-content',
      maxWidth:      '90%',
      textAlign:     'center',
    });
  }

  // Set bottom offset = control-bar-container height + gap, so the overlay
  // sits just above the progress bar + control buttons.
  private updateUdemyInVideoBottom(controlBarContainer: HTMLElement | null): void {
    if (!this.container) return;
    const h = controlBarContainer ? controlBarContainer.getBoundingClientRect().height : 55;
    this.container.style.bottom = `${h + 8}px`;
  }

  // Styles for the position:fixed fallback (shaka container not found).
  private applyUdemyBaseStyles(settings: Settings): void {
    Object.assign(this.container!.style, {
      position:      'fixed',
      left:          '50%',
      transform:     'translateX(-50%)',
      zIndex:        '2147483647',
      pointerEvents: 'none',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           `${settings.spacing}px`,
      maxWidth:      '80%',
      textAlign:     'center',
    });
  }

  private onFullscreenChange(settings: Settings): void {
    if (!this.container) return;

    if (this.playerEl) {
      // Mounted inside the video player — the DOM handles fullscreen naturally.
      this.applyLineStyles(settings);
      return;
    }

    // Fallback fixed-positioning case
    const fsEl = document.fullscreenElement as HTMLElement | null;
    if (fsEl) {
      const pos = window.getComputedStyle(fsEl).position;
      if (pos === 'static') fsEl.style.position = 'relative';
      fsEl.appendChild(this.container);
      Object.assign(this.container.style, {
        position:  'fixed',
        left:      '50%',
        transform: 'translateX(-50%)',
        bottom:    '12%',
        top:       'auto',
      });
      this.applyLineStyles(settings);
    } else {
      document.body.appendChild(this.container);
      this.applyUdemyBaseStyles(settings);
      this.applyLineStyles(settings);
      this.refreshUdemyPosition();
    }
  }

  // Only used by the position:fixed fallback (when control bar is not found).
  private refreshUdemyPosition(): void {
    if (!this.container) return;
    if (this.playerEl) return; // in-player: position:absolute handles it
    if (document.fullscreenElement) return;

    const video = document.querySelector('video');
    if (!video) return;
    const rect = video.getBoundingClientRect();

    this.container.style.left = `${rect.left + rect.width / 2}px`;
    this.container.style.maxWidth = `${Math.floor(rect.width * 0.9)}px`;
    const belowVideo = Math.max(0, window.innerHeight - rect.bottom);
    this.container.style.top  = 'auto';
    this.container.style.bottom = `${belowVideo + 55}px`;
  }

  // ── YouTube / generic: absolute inside the player ─────────────────────────

  private mountInPlayer(settings: Settings): void {
    const player = this.findPlayerContainer();

    if (player) {
      const pos = window.getComputedStyle(player).position;
      if (pos === 'static') {
        player.dataset['dualsubsPos'] = pos;
        player.style.position = 'relative';
      }
      player.appendChild(this.container!);
      this.playerEl = player;
    } else {
      document.body.appendChild(this.container!);
    }

    this.applyPositionStyles(settings);
    this.applyLineStyles(settings);
  }

  private findPlayerContainer(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('.html5-video-container') ??
      document.querySelector<HTMLElement>('#movie_player') ??
      (() => {
        const video = document.querySelector('video');
        let el = video?.parentElement;
        while (el && el !== document.body) {
          const r = el.getBoundingClientRect();
          if (r.width > 300 && r.height > 150) return el;
          el = el.parentElement;
        }
        return null;
      })()
    );
  }

  private applyPositionStyles(settings: Settings): void {
    if (!this.container || this.isUdemy) return;
    const { position, spacing } = settings;
    Object.assign(this.container.style, {
      position:      this.playerEl ? 'absolute' : 'fixed',
      left:          '50%',
      transform:     'translateX(-50%)',
      zIndex:        '2147483647',
      pointerEvents: 'none',
      textAlign:     'center',
      maxWidth:      '90%',
      width:         'max-content',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           `${spacing}px`,
      top:           position === 'top'    ? '6%'  : 'auto',
      bottom:        position === 'bottom' ? '12%' : 'auto',
    });
  }

  private applyLineStyles(settings: Settings): void {
    const { fontSize, fontColor, bgColor, bgOpacity } = settings;
    const bg = hexToRgba(bgColor, bgOpacity);
    const style: Partial<CSSStyleDeclaration> = {
      fontSize:     `${fontSize}px`,
      color:        fontColor,
      background:   bg,
      padding:      '4px 14px',
      borderRadius: '5px',
      lineHeight:   '1.45',
      textShadow:   '0 1px 3px rgba(0,0,0,0.85)',
      display:      'inline-block',
      maxWidth:     '100%',
      whiteSpace:   'pre-wrap',
    };
    if (this.originalEl)   Object.assign(this.originalEl.style,   style);
    if (this.translatedEl) Object.assign(this.translatedEl.style, style);
  }
}

function hexToRgba(hex: string, opacity: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
