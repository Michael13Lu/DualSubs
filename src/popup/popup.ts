import { DEFAULT_SETTINGS, Settings } from '../types';

const LANGUAGES = [
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pl', name: 'Polish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
];

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('dualsubs_settings', (data) => {
      resolve({ ...DEFAULT_SETTINGS, ...data['dualsubs_settings'] });
    });
  });
}

function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ dualsubs_settings: settings }, resolve);
  });
}

function readForm(): Settings {
  return {
    enabled: byId<HTMLInputElement>('enabled').checked,
    targetLanguage: byId<HTMLSelectElement>('targetLanguage').value,
    showOriginal: byId<HTMLInputElement>('showOriginal').checked,
    position: byId<HTMLSelectElement>('position').value as Settings['position'],
    fontSize: Number(byId<HTMLInputElement>('fontSize').value),
    fontColor: byId<HTMLInputElement>('fontColor').value,
    bgColor: byId<HTMLInputElement>('bgColor').value,
    bgOpacity: Number(byId<HTMLInputElement>('bgOpacity').value),
    spacing: Number(byId<HTMLInputElement>('spacing').value),
    translationProvider: byId<HTMLSelectElement>('provider')
      .value as Settings['translationProvider'],
    apiKey: byId<HTMLInputElement>('apiKey').value,
  };
}

function fillForm(s: Settings): void {
  // Populate language list
  const langSel = byId<HTMLSelectElement>('targetLanguage');
  langSel.innerHTML = '';
  LANGUAGES.forEach(({ code, name }) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    opt.selected = code === s.targetLanguage;
    langSel.appendChild(opt);
  });

  byId<HTMLInputElement>('enabled').checked = s.enabled;
  byId<HTMLInputElement>('showOriginal').checked = s.showOriginal;
  byId<HTMLSelectElement>('position').value = s.position;
  byId<HTMLInputElement>('fontSize').value = String(s.fontSize);
  byId<HTMLSpanElement>('fontSizeVal').textContent = String(s.fontSize);
  byId<HTMLInputElement>('fontColor').value = s.fontColor;
  byId<HTMLInputElement>('bgColor').value = s.bgColor;
  byId<HTMLInputElement>('bgOpacity').value = String(s.bgOpacity);
  byId<HTMLSpanElement>('bgOpacityVal').textContent = String(s.bgOpacity);
  byId<HTMLInputElement>('spacing').value = String(s.spacing);
  byId<HTMLSpanElement>('spacingVal').textContent = String(s.spacing);
  byId<HTMLSelectElement>('provider').value = s.translationProvider;
  byId<HTMLInputElement>('apiKey').value = s.apiKey;
  toggleApiKey(s.translationProvider);
}

function toggleApiKey(provider: string): void {
  byId('apiKeyRow').style.display = provider === 'mymemory' ? 'none' : 'flex';
}

function showStatus(msg: string): void {
  const el = byId('status');
  el.textContent = msg;
  el.style.opacity = '1';
  setTimeout(() => (el.style.opacity = '0'), 2000);
}

async function init(): Promise<void> {
  const settings = await loadSettings();
  fillForm(settings);

  // Range live feedback
  (['fontSize', 'bgOpacity', 'spacing'] as const).forEach((id) => {
    byId<HTMLInputElement>(id).addEventListener('input', (e) => {
      byId<HTMLSpanElement>(`${id}Val`).textContent = (
        e.target as HTMLInputElement
      ).value;
    });
  });

  byId<HTMLSelectElement>('provider').addEventListener('change', (e) => {
    toggleApiKey((e.target as HTMLSelectElement).value);
  });

  byId('saveBtn').addEventListener('click', async () => {
    await saveSettings(readForm());
    showStatus('Saved!');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(console.error);
});
