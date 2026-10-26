import type { AppPreferences, LayoutMode, PaperSize, MarginOption, FilterType } from '../types';

export const DEFAULT_PREFERENCES: AppPreferences = {
  autoCropOnUpload: false,
  autoEnhanceOnCrop: true,
  defaultLayout: '2-up-vertical',
  paperSize: 'a4',
  orientation: 'portrait',
  margins: 'standard',
  showCuttingLines: false, // Default: no print marks/guides
  showPageNumbers: false,  // Default: no print marks/guides
  defaultFilter: 'clean-doc',
  askTwoUpPrompt: true,
  theme: 'dark'
};

const STORAGE_KEY = 'printperfect_app_prefs_v1';

export function loadPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to parse preferences from localStorage:', e);
  }
  return { ...DEFAULT_PREFERENCES };
}

export function savePreferences(prefs: AppPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save preferences to localStorage:', e);
  }
}

export class SettingsModal {
  private overlay: HTMLElement;
  private currentPrefs: AppPreferences;
  private onPreferencesChange: (newPrefs: AppPreferences) => void;

  constructor(options: { onPreferencesChange: (newPrefs: AppPreferences) => void }) {
    this.currentPrefs = loadPreferences();
    this.onPreferencesChange = options.onPreferencesChange;

    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-modal-overlay';
    this.render();
    document.body.appendChild(this.overlay);
    this.bindEvents();
  }

  public getPreferences(): AppPreferences {
    return this.currentPrefs;
  }

  public updatePreference<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) {
    this.currentPrefs[key] = value;
    savePreferences(this.currentPrefs);
    this.onPreferencesChange(this.currentPrefs);
    this.render();
    this.bindEvents();
  }

  public open() {
    this.currentPrefs = loadPreferences();
    this.render();
    this.bindEvents();
    this.overlay.classList.add('active');
  }

  public close() {
    this.overlay.classList.remove('active');
  }

  private render() {
    const p = this.currentPrefs;

    this.overlay.innerHTML = `
      <div class="settings-modal-container">
        <div class="settings-modal-header">
          <div class="settings-header-title">
            <div class="settings-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </div>
            <div>
              <h3>Printing & Workflow Preferences</h3>
              <p>Preferences are automatically saved to local cache and applied instantly.</p>
            </div>
          </div>
          <button id="btn-settings-close" class="btn-icon-close">✕</button>
        </div>

        <div class="settings-modal-body">
          <!-- 0. Appearance Theme (Dark / Light) -->
          <div class="settings-group">
            <div class="settings-group-header">
              <h4>Appearance & Theme</h4>
              <p>Switch between sleek dark mode and high-contrast light mode.</p>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-theme">Interface Theme</label>
                <span class="setting-desc">Sets colors across studio workspace, toolbars, and menus.</span>
              </div>
              <select id="pref-theme" class="settings-select">
                <option value="dark" ${p.theme === 'dark' ? 'selected' : ''}>🌙 Dark Mode (Default)</option>
                <option value="light" ${p.theme === 'light' ? 'selected' : ''}>☀️ Light Mode</option>
              </select>
            </div>
          </div>

          <!-- 1. Auto-Cropping Section (Highlighted Requirement) -->
          <div class="settings-group highlight-box">
            <div class="settings-group-header">
              <span class="group-badge">CORE WORKFLOW</span>
              <h4>Automatic Edge Detection & Cropping</h4>
              <p>Choose whether uploaded images are automatically cropped or held for manual corner verification.</p>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-auto-crop">Always Auto-Crop on Upload</label>
                <span class="setting-desc">Automatically applies perspective rectification using detected document edges upon upload without prompting.</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="pref-auto-crop" ${p.autoCropOnUpload ? 'checked' : ''} />
                <span class="slider"></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-auto-enhance">Auto-Enhance Documents</label>
                <span class="setting-desc">Removes background grayness, whitens paper margins, and sharpens text immediately after cropping.</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="pref-auto-enhance" ${p.autoEnhanceOnCrop ? 'checked' : ''} />
                <span class="slider"></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-ask-two-up">Prompt for "2 Images in 1 A4 Sheet"</label>
                <span class="setting-desc">Shows layout recommendation modal after cropping to choose between single page or dual-image A4 print.</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="pref-ask-two-up" ${p.askTwoUpPrompt ? 'checked' : ''} />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- 2. Sheet Layout & Paper Section -->
          <div class="settings-group">
            <div class="settings-group-header">
              <h4>Default Print Layout & Paper Format</h4>
              <p>Set default parameters for physical printouts and exported PDF documents.</p>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-default-layout">Default Page Layout</label>
                <span class="setting-desc">How images are arranged on each printed sheet.</span>
              </div>
              <select id="pref-default-layout" class="settings-select">
                <option value="2-up-vertical" ${p.defaultLayout === '2-up-vertical' ? 'selected' : ''}>2 Images per A4 (Top & Bottom / Split)</option>
                <option value="2-up-horizontal" ${p.defaultLayout === '2-up-horizontal' ? 'selected' : ''}>2 Images per A4 (Side by Side)</option>
                <option value="1-up" ${p.defaultLayout === '1-up' ? 'selected' : ''}>1 Image per Sheet (Full Page)</option>
                <option value="id-card-duplex" ${p.defaultLayout === 'id-card-duplex' ? 'selected' : ''}>2-in-1 ID Card Duplex (Real Scale 85.6mm)</option>
                <option value="4-up" ${p.defaultLayout === '4-up' ? 'selected' : ''}>4 Images per Sheet (4-Up Grid)</option>
              </select>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-paper-size">Paper Size</label>
                <span class="setting-desc">Standard paper dimensions for your target printer.</span>
              </div>
              <select id="pref-paper-size" class="settings-select">
                <option value="a4" ${p.paperSize === 'a4' ? 'selected' : ''}>A4 (210 × 297 mm)</option>
                <option value="letter" ${p.paperSize === 'letter' ? 'selected' : ''}>US Letter (8.5 × 11 in)</option>
                <option value="legal" ${p.paperSize === 'legal' ? 'selected' : ''}>Legal (8.5 × 14 in)</option>
              </select>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-margins">Page Margins</label>
                <span class="setting-desc">Outer white margin for printer feed roller safety.</span>
              </div>
              <select id="pref-margins" class="settings-select">
                <option value="none" ${p.margins === 'none' ? 'selected' : ''}>None (Borderless 0mm)</option>
                <option value="narrow" ${p.margins === 'narrow' ? 'selected' : ''}>Narrow (5mm)</option>
                <option value="standard" ${p.margins === 'standard' ? 'selected' : ''}>Standard (12mm)</option>
                <option value="wide" ${p.margins === 'wide' ? 'selected' : ''}>Wide (20mm)</option>
              </select>
            </div>
          </div>

          <!-- 3. Printing Enhancements & Guidelines -->
          <div class="settings-group">
            <div class="settings-group-header">
              <h4>Guides & Output Helpers</h4>
              <p>Cutting guidelines and markings (disabled by default for clean presentation).</p>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-cutting-lines">Print Scissor / Cutting Lines</label>
                <span class="setting-desc">Prints thin dashed guidelines between multi-up images to guide scissors or paper trimmer.</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="pref-cutting-lines" ${p.showCuttingLines ? 'checked' : ''} />
                <span class="slider"></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-page-numbers">Show Page Footer & Numbers</label>
                <span class="setting-desc">Includes subtle "Page X of Y" in the bottom margin.</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="pref-page-numbers" ${p.showPageNumbers ? 'checked' : ''} />
                <span class="slider"></span>
              </label>
            </div>

            <div class="setting-row">
              <div class="setting-text">
                <label for="pref-default-filter">Default Enhancement Filter</label>
                <span class="setting-desc">Preset image enhancement to apply to new documents.</span>
              </div>
              <select id="pref-default-filter" class="settings-select">
                <option value="clean-doc" ${p.defaultFilter === 'clean-doc' ? 'selected' : ''}>Clean Document (Whitened paper + dark text)</option>
                <option value="magic-bw" ${p.defaultFilter === 'magic-bw' ? 'selected' : ''}>Magic B&W Scanner (High contrast black & white)</option>
                <option value="grayscale" ${p.defaultFilter === 'grayscale' ? 'selected' : ''}>Grayscale (Ink Saver)</option>
                <option value="vivid" ${p.defaultFilter === 'vivid' ? 'selected' : ''}>Vivid Color (Boost clarity for diagrams)</option>
                <option value="original" ${p.defaultFilter === 'original' ? 'selected' : ''}>Original (No filter)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="settings-modal-footer">
          <button id="btn-reset-prefs" class="btn-subtle text-danger">Reset to Defaults</button>
          <div class="footer-actions-right">
            <button id="btn-cancel-settings" class="btn-secondary">Close</button>
            <button id="btn-save-prefs" class="btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents() {
    const btnClose = this.overlay.querySelector('#btn-settings-close');
    const btnCancel = this.overlay.querySelector('#btn-cancel-settings');
    const btnSave = this.overlay.querySelector('#btn-save-prefs');
    const btnReset = this.overlay.querySelector('#btn-reset-prefs');

    btnClose?.addEventListener('click', () => this.close());
    btnCancel?.addEventListener('click', () => this.close());

    btnSave?.addEventListener('click', () => {
      this.collectValues();
      savePreferences(this.currentPrefs);
      this.onPreferencesChange(this.currentPrefs);
      this.showToast('Preferences stored in local cache and applied!');
      this.close();
    });

    btnReset?.addEventListener('click', () => {
      if (confirm('Reset all printing and workflow preferences to default values?')) {
        this.currentPrefs = { ...DEFAULT_PREFERENCES };
        savePreferences(this.currentPrefs);
        this.onPreferencesChange(this.currentPrefs);
        this.render();
        this.bindEvents();
        this.showToast('Preferences reset to default.');
      }
    });

    // Auto-save on individual toggle switches for snappy experience
    const autoCropCheck = this.overlay.querySelector('#pref-auto-crop') as HTMLInputElement;
    autoCropCheck?.addEventListener('change', () => {
      this.currentPrefs.autoCropOnUpload = autoCropCheck.checked;
      savePreferences(this.currentPrefs);
      this.onPreferencesChange(this.currentPrefs);
      this.showToast(autoCropCheck.checked ? 'Auto-crop enabled in cache' : 'Auto-crop turned off');
    });

    const themeSelect = this.overlay.querySelector('#pref-theme') as HTMLSelectElement;
    themeSelect?.addEventListener('change', () => {
      this.currentPrefs.theme = themeSelect.value as 'dark' | 'light';
      savePreferences(this.currentPrefs);
      this.onPreferencesChange(this.currentPrefs);
    });
  }

  private collectValues() {
    const autoCrop = (this.overlay.querySelector('#pref-auto-crop') as HTMLInputElement)?.checked ?? false;
    const autoEnhance = (this.overlay.querySelector('#pref-auto-enhance') as HTMLInputElement)?.checked ?? true;
    const askTwoUp = (this.overlay.querySelector('#pref-ask-two-up') as HTMLInputElement)?.checked ?? true;
    const cutLines = (this.overlay.querySelector('#pref-cutting-lines') as HTMLInputElement)?.checked ?? false;
    const pageNum = (this.overlay.querySelector('#pref-page-numbers') as HTMLInputElement)?.checked ?? false;

    const layout = (this.overlay.querySelector('#pref-default-layout') as HTMLSelectElement)?.value as LayoutMode;
    const paper = (this.overlay.querySelector('#pref-paper-size') as HTMLSelectElement)?.value as PaperSize;
    const margins = (this.overlay.querySelector('#pref-margins') as HTMLSelectElement)?.value as MarginOption;
    const filter = (this.overlay.querySelector('#pref-default-filter') as HTMLSelectElement)?.value as FilterType;
    const theme = ((this.overlay.querySelector('#pref-theme') as HTMLSelectElement)?.value || 'dark') as 'dark' | 'light';

    this.currentPrefs = {
      autoCropOnUpload: autoCrop,
      autoEnhanceOnCrop: autoEnhance,
      askTwoUpPrompt: askTwoUp,
      showCuttingLines: cutLines,
      showPageNumbers: pageNum,
      defaultLayout: layout,
      paperSize: paper,
      orientation: this.currentPrefs.orientation,
      margins: margins,
      defaultFilter: filter,
      theme: theme
    };
  }

  private showToast(msg: string) {
    const toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}
