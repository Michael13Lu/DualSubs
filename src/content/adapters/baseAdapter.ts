export type SubtitleCallback = (text: string) => void;

export interface PlatformAdapter {
  readonly name: string;
  matches(): boolean;
  start(callback: SubtitleCallback): void;
  stop(): void;
}
