import { Settings } from '../../types';

const OVERLAY_ID = 'dualsubs-overlay';

export class UIOverlayService {
  private container: HTMLDivElement | null = null;
  private originalEl: HTMLDivElement | null = null;
  private translatedEl: HTMLDivElement | null = null;

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
  }

  applySettings(settings: Settings): void {
    if (!this.container) return;
    this.applyPositionStyles(settings);
    this.applyLineStyles(settings);
  }

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
    document.body.appendChild(this.container);

    this.applyPositionStyles(settings);
    this.applyLineStyles(settings);
  }

  private applyPositionStyles(settings: Settings): void {
    if (!this.container) return;
    const { position, spacing } = settings;

    Object.assign(this.container.style, {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      pointerEvents: 'none',
      textAlign: 'center',
      maxWidth: '80%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: `${spacing}px`,
      top: position === 'top' ? '10%' : 'auto',
      bottom: position === 'bottom' ? '12%' : 'auto',
    });
  }

  private applyLineStyles(settings: Settings): void {
    const { fontSize, fontColor, bgColor, bgOpacity } = settings;
    const bg = hexToRgba(bgColor, bgOpacity);
    const lineStyle = {
      fontSize: `${fontSize}px`,
      color: fontColor,
      background: bg,
      padding: '3px 10px',
      borderRadius: '4px',
      lineHeight: '1.45',
      textShadow: '1px 1px 2px rgba(0,0,0,0.85)',
      display: 'inline-block',
      maxWidth: '100%',
    };
    if (this.originalEl) Object.assign(this.originalEl.style, lineStyle);
    if (this.translatedEl) Object.assign(this.translatedEl.style, lineStyle);
  }
}

function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
