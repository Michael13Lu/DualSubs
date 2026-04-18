import { Settings } from '../../types';

const OVERLAY_ID = 'dualsubs-overlay';

export class UIOverlayService {
  private container: HTMLDivElement | null = null;
  private originalEl: HTMLDivElement | null = null;
  private translatedEl: HTMLDivElement | null = null;
  private playerEl: HTMLElement | null = null;

  show(originalText: string, translatedText: string, settings: Settings): void {
    this.ensureContainer(settings);
    if (!this.container) return;

    this.container.style.display = 'flex';

    if (this.originalEl) {
      this.originalEl.textContent = originalText;
      this.originalEl.style.display = settings.showOriginal ? '' : 'none';
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
    // Undo position:relative we may have set on the player
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

    const player = this.findPlayerContainer();

    this.container = document.createElement('div');
    this.container.id = OVERLAY_ID;

    this.originalEl = document.createElement('div');
    this.originalEl.className = 'dualsubs-original';

    this.translatedEl = document.createElement('div');
    this.translatedEl.className = 'dualsubs-translated';

    this.container.appendChild(this.originalEl);
    this.container.appendChild(this.translatedEl);

    if (player) {
      // Ensure the player is a positioning context
      const computed = window.getComputedStyle(player);
      if (computed.position === 'static') {
        player.dataset['dualsubsPos'] = computed.position;
        player.style.position = 'relative';
      }
      player.appendChild(this.container);
      this.playerEl = player;
    } else {
      document.body.appendChild(this.container);
    }

    this.applyPositionStyles(settings);
    this.applyLineStyles(settings);
  }

  private findPlayerContainer(): HTMLElement | null {
    // YouTube
    const yt =
      document.querySelector<HTMLElement>('.html5-video-container') ??
      document.querySelector<HTMLElement>('#movie_player');
    if (yt) return yt;

    // Udemy / generic — walk up from <video> to find a large enough box
    const video = document.querySelector('video');
    if (!video) return null;

    let el = video.parentElement;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.width > 300 && r.height > 150) return el;
      el = el.parentElement;
    }
    return null;
  }

  private applyPositionStyles(settings: Settings): void {
    if (!this.container) return;
    const { position, spacing } = settings;
    const isEmbedded = !!this.playerEl;

    Object.assign(this.container.style, {
      position:       isEmbedded ? 'absolute' : 'fixed',
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
    const style: Partial<CSSStyleDeclaration> = {
      fontSize:   `${fontSize}px`,
      color:      fontColor,
      background: bg,
      padding:    '4px 12px',
      borderRadius: '5px',
      lineHeight: '1.45',
      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
      display:    'inline-block',
      maxWidth:   '100%',
      whiteSpace: 'pre-wrap',
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
