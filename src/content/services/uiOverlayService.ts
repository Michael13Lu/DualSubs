import { Settings } from '../../types';

const OVERLAY_ID = 'dualsubs-overlay';

export class UIOverlayService {
  private container: HTMLDivElement | null = null;
  private originalEl: HTMLDivElement | null = null;
  private translatedEl: HTMLDivElement | null = null;
  private playerEl: HTMLElement | null = null;

  private get isUdemy(): boolean {
    return window.location.hostname.includes('udemy.com');
  }

  show(originalText: string, translatedText: string, settings: Settings): void {
    this.ensureContainer(settings);
    if (!this.container) return;

    this.container.style.display = 'flex';

    if (this.originalEl) {
      // On Udemy the platform already renders the original — don't duplicate it
      const showOrig = settings.showOriginal && !this.isUdemy;
      this.originalEl.textContent = originalText;
      this.originalEl.style.display = showOrig ? '' : 'none';
    }
    if (this.translatedEl) {
      this.translatedEl.textContent = translatedText;
    }
  }

  clear(): void {
    if (!this.container) return;
    this.container.style.display = 'none';
    if (this.originalEl) this.originalEl.textContent = '';
    if (this.translatedEl) this.translatedEl.textContent = '';
  }

  destroy(): void {
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
    this.applyPositionStyles(settings);
    this.applyLineStyles(settings);
  }

  // ── Private ───────────────────────────────────────────────────────────────

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
      this.mountOverlay(settings);
    }
  }

  // ── Udemy: block element below the subtitle area ──────────────────────────

  private mountUdemy(settings: Settings): void {
    // Find the container that holds the player + Udemy's own subtitle
    // and append our translation as a plain block after all of it.
    const parent = this.findUdemySubtitleParent();

    if (parent) {
      parent.appendChild(this.container!);
      this.playerEl = parent;
    } else {
      document.body.appendChild(this.container!);
    }

    // Style as a full-width block row in the normal document flow
    Object.assign(this.container!.style, {
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      width:          '100%',
      padding:        '6px 16px 8px',
      boxSizing:      'border-box',
      gap:            `${settings.spacing}px`,
      zIndex:         '9999',
      pointerEvents:  'none',
    });

    this.applyLineStyles(settings); // ← was missing, caused invisible text
  }

  /** Walk up from the video-viewer to find the section that also holds the subtitle */
  private findUdemySubtitleParent(): HTMLElement | null {
    const playerSelectors = [
      '[class*="video-viewer--container"]',
      '[data-purpose="video-component"]',
      '[data-purpose="video-player"]',
    ];

    for (const sel of playerSelectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el?.parentElement) return el.parentElement;
    }

    // Fallback: two levels above <video>
    const video = document.querySelector('video');
    return video?.parentElement?.parentElement ?? video?.parentElement ?? null;
  }

  // ── YouTube / generic: absolute overlay inside the player ────────────────

  private mountOverlay(settings: Settings): void {
    const player = this.findPlayerContainer();

    if (player) {
      const computed = window.getComputedStyle(player);
      if (computed.position === 'static') {
        player.dataset['dualsubsPos'] = computed.position;
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
      position:       this.playerEl ? 'absolute' : 'fixed',
      left:           '50%',
      transform:      'translateX(-50%)',
      zIndex:         '2147483647',
      pointerEvents:  'none',
      textAlign:      'center',
      maxWidth:       '90%',
      width:          'max-content',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      gap:            `${spacing}px`,
      top:            position === 'top'    ? '6%'  : 'auto',
      bottom:         position === 'bottom' ? '12%' : 'auto',
    });
  }

  private applyLineStyles(settings: Settings): void {
    const { fontSize, fontColor, bgColor, bgOpacity } = settings;
    const bg = hexToRgba(bgColor, bgOpacity);

    const base: Partial<CSSStyleDeclaration> = {
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

    if (this.originalEl)   Object.assign(this.originalEl.style,   base);
    if (this.translatedEl) Object.assign(this.translatedEl.style, base);
  }
}

function hexToRgba(hex: string, opacity: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
