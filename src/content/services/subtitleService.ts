import { PlatformAdapter, SubtitleCallback } from '../adapters/baseAdapter';
import { YouTubeAdapter } from '../adapters/youtubeAdapter';
import { UdemyAdapter } from '../adapters/udemyAdapter';

export class SubtitleService {
  private readonly adapters: PlatformAdapter[] = [
    new YouTubeAdapter(),
    new UdemyAdapter(),
  ];

  private active: PlatformAdapter | null = null;

  start(callback: SubtitleCallback): void {
    const adapter = this.adapters.find((a) => a.matches());
    if (!adapter) {
      console.debug('[DualSubs] No adapter matched for this platform');
      return;
    }
    console.log(`[DualSubs] Activating adapter: ${adapter.name}`);
    this.active = adapter;
    adapter.start(callback);
  }

  stop(): void {
    this.active?.stop();
    this.active = null;
  }
}
