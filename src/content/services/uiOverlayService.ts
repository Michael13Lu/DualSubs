import { Settings } from '../../types';

const OVERLAY_ID = 'dualsubs-overlay';

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
      const showOrig = settings.showOriginal && !this.isUdemy;
      this.originalEl.textContent = originalText;
      this.originalEl.style.display = showOrig ? '' : 'none';
    }
    if (this.translatedEl) {
      this.translatedEl.textContent = translatedText;
    }

    if (this.isUdemy) this.refreshUdemyPosition();
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
      this.mountUdemy(settings);
    } else {
      this.mountInPlayer(settings);
    }
  }

  // ── Udemy: fixed overlay, moves into fullscreen element when needed ────────

  private mountUdemy(settings: Settings): void {
    this.applyUdemyBaseStyles(settings);
    document.body.appendChild(this.container!);
    this.refreshUdemyPosition();

    const onScrollResize = () => this.refreshUdemyPosition();
    const onFullscreen = () => this.onFullscreenChange(settings);

    window.addEventListener('scroll', onScrollResize, { passive: true });
    window.addEventListener('resize', onScrollResize, { passive: true });
    document.addEventListener('fullscreenchange', onFullscreen);

    this.positionCleanup = () => {
      window.removeEventListener('scroll', onScrollResize);
      window.removeEventListener('resize', onScrollResize);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };

    this.applyLineStyles(settings);
  }

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

    const fsEl = document.fullscreenElement as HTMLElement | null;

    if (fsEl) {
      // Entering fullscreen — move overlay inside the fullscreen element
      // so it appears in the top layer.
      const pos = window.getComputedStyle(fsEl).position;
      if (pos === 'static') fsEl.style.position = 'relative';

      fsEl.appendChild(this.container);

      // In fullscreen, position absolutely at the bottom of the screen
      Object.assign(this.container.style, {
        position:  'fixed',
        left:      '50%',
        transform: 'translateX(-50%)',
        bottom:    '80px', // above the subtitle line in fullscreen
        top:       'auto',
      });
      this.applyLineStyles(settings);
    } else {
      // Exiting fullscreen — move back to body
      document.body.appendChild(this.container);
      this.applyUdemyBaseStyles(settings);
      this.applyLineStyles(settings);
      this.refreshUdemyPosition();
    }
  }

  /**
   * Position the overlay right below the Udemy subtitle line (windowed mode).
   * Measures video bottom + control bar (≈50px) + subtitle row (≈34px).
   */
  private refreshUdemyPosition(): void {
    if (!this.container) return;
    if (document.fullscreenElement) return; // managed by onFullscreenChange

    const video = document.querySelector('video');
    if (!video) return;

    const rect = video.getBoundingClientRect();
    const top = rect.bottom + 50 + 34;

    this.container.style.top    = `${top}px`;
    this.container.style.bottom = 'auto';
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
