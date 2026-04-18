import { DEFAULT_SETTINGS, Settings } from '../types';
import { SubtitleService } from './services/subtitleService';
import { TranslationService } from './services/translationService';
import { UIOverlayService } from './services/uiOverlayService';
import { debounce } from './utils/debounce';

class DualSubsController {
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private readonly subtitleSvc = new SubtitleService();
  private readonly translationSvc = new TranslationService();
  private readonly uiSvc = new UIOverlayService();
  private lastText = '';

  async init(): Promise<void> {
    this.settings = await loadSettings();
    chrome.storage.onChanged.addListener(this.onStorageChange);

    if (this.settings.enabled) {
      this.startCapture();
    }
    console.log('[DualSubs] Initialized');
  }

  private startCapture(): void {
    const handle = debounce(async (text: string) => {
      if (text === this.lastText) return;
      this.lastText = text;

      if (!text) {
        this.uiSvc.clear();
        return;
      }

      console.debug('[DualSubs] Translating:', text);
      const translated = await this.translationSvc.translate(
        text,
        this.settings
      );
      console.debug('[DualSubs] Result:', translated);
      if (translated) {
        this.uiSvc.show(text, translated, this.settings);
      }
    }, 150);

    this.subtitleSvc.start(handle);
  }

  private stopCapture(): void {
    this.subtitleSvc.stop();
    this.uiSvc.destroy();
    this.lastText = '';
  }

  private onStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>
  ): void => {
    if (!changes['dualsubs_settings']) return;

    const prev = this.settings;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(changes['dualsubs_settings'].newValue as Partial<Settings>),
    };

    if (this.settings.enabled && !prev.enabled) {
      this.startCapture();
    } else if (!this.settings.enabled && prev.enabled) {
      this.stopCapture();
    } else if (this.settings.enabled) {
      this.uiSvc.applySettings(this.settings);
    }
  };
}

function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('dualsubs_settings', (data) => {
      resolve({ ...DEFAULT_SETTINGS, ...data['dualsubs_settings'] });
    });
  });
}

new DualSubsController().init().catch(console.error);
