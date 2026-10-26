import './style.css';
import type { ImageItem, LayoutMode, AppPreferences } from './types';
import { detectDocumentEdges } from './utils/edgeDetector';
import { warpPerspective } from './utils/perspectiveWarp';
import { processImageEnhancement, loadImage } from './utils/imageFilters';
import { CropModal } from './components/CropModal';
import { SettingsModal, loadPreferences, savePreferences } from './components/SettingsModal';
import { LayoutPromptModal } from './components/LayoutPromptModal';
import { PrintPreview } from './components/PrintPreview';
import { createSampleInvoice, createSampleIdCard } from './utils/sampleData';

class App {
  private images: ImageItem[] = [];
  private preferences: AppPreferences;
  private cropModal: CropModal;
  private settingsModal: SettingsModal;
  private layoutPromptModal: LayoutPromptModal;
  private printPreview: PrintPreview | null = null;
  private dropZone: HTMLElement | null = null;
  private fileInput: HTMLInputElement | null = null;

  constructor() {
    this.preferences = loadPreferences();

    // Initialize modals
    this.cropModal = new CropModal({
      onCropDone: (updatedImage) => this.handleCropDone(updatedImage),
      onCancel: () => this.handleCropCancel()
    });

    this.settingsModal = new SettingsModal({
      onPreferencesChange: (newPrefs) => this.handlePreferencesChanged(newPrefs)
    });

    this.layoutPromptModal = new LayoutPromptModal({
      onSelectLayout: (selectedLayout, remember) => this.handleLayoutPromptSelection(selectedLayout, remember),
      onDismiss: () => {}
    });

    this.initDOM();
    this.applyTheme(this.preferences.theme);
    this.bindGlobalEvents();
  }

  private initDOM() {
    const appEl = document.querySelector<HTMLDivElement>('#app')!;
    appEl.innerHTML = `
      <div class="app-shell">
        <!-- Global App Header -->
        <header class="app-header">
          <div class="header-brand">
            <div class="brand-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <polyline points="6 9 6 2 18 2 18 9"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
            </div>
            <div>
              <div class="brand-title">PrintPerfect <span class="brand-badge">STUDIO</span></div>
              <div class="brand-subtitle">Smart Document Edge Detection & A4 Layout Platform</div>
            </div>
          </div>

          <div class="header-controls">
            <!-- Fast Auto-Crop Toggle in Header for Direct Access -->
            <div class="header-pref-toggle" title="Toggle automatic perspective cropping for uploads">
              <span class="toggle-text">Auto-Crop:</span>
              <label class="toggle-switch compact">
                <input type="checkbox" id="header-toggle-autocrop" ${this.preferences.autoCropOnUpload ? 'checked' : ''} />
                <span class="slider"></span>
              </label>
            </div>

            <!-- Sample Dropdown -->
            <div class="dropdown-wrapper">
              <button id="btn-samples-menu" class="btn-subtle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                Load Samples ▾
              </button>
              <div class="dropdown-menu" id="samples-dropdown">
                <button class="dropdown-item" id="sample-item-invoice">
                  <span class="item-icon">🧾</span>
                  <div>
                    <strong>Store Receipt / Invoice</strong>
                    <span>Test skewed desk edge detection</span>
                  </div>
                </button>
                <button class="dropdown-item" id="sample-item-idcard">
                  <span class="item-icon">🪪</span>
                  <div>
                    <strong>2-in-1 ID Card (Front & Back)</strong>
                    <span>Test dual card printing on 1 A4</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Theme Mode Toggle -->
            <button id="btn-toggle-theme" class="btn-subtle" title="Toggle Light / Dark mode">
              <span id="theme-btn-icon">${this.preferences.theme === 'light' ? '🌙' : '☀️'}</span>
              <span id="theme-btn-label">${this.preferences.theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>

            <!-- Settings Button -->
            <button id="btn-open-settings" class="btn-secondary" title="Open Print & Workflow Preferences">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>

            <!-- Clear Queue -->
            <button id="btn-clear-all" class="btn-subtle text-danger" title="Clear all documents">Clear</button>
          </div>
        </header>

        <!-- Upload Drop Zone Hero Area -->
        <section class="upload-section">
          <div class="drop-zone" id="main-drop-zone">
            <input type="file" id="file-upload-input" multiple accept="image/jpeg,image/png,image/webp,image/jpg" style="display:none;" />
            
            <div class="drop-zone-content">
              <div class="drop-icon-pulse">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="36" height="36">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div class="drop-text-group">
                <h3>Drag & Drop Documents or Images Here</h3>
                <p>Supports camera photos, receipts, IDs, notes, and PDF exports (JPG, PNG, WEBP)</p>
              </div>
              <div class="drop-actions-row">
                <button id="btn-select-files" class="btn-primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Browse Files
                </button>
                <button id="btn-camera-capture" class="btn-secondary" title="Capture from webcam/phone camera">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  Use Camera
                </button>
              </div>
            </div>

            <div class="drop-features-bar">
              <div class="feature-item">
                <span class="feature-dot"></span>
                <span>AI Sobel Edge Detection</span>
              </div>
              <div class="feature-item">
                <span class="feature-dot"></span>
                <span>4-Corner Perspective Warp</span>
              </div>
              <div class="feature-item">
                <span class="feature-dot"></span>
                <span>2-in-1 A4 Sheet Layout</span>
              </div>
              <div class="feature-item">
                <span class="feature-dot"></span>
                <span>Ink Saver & Clean B&W Filters</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Main Studio Area: Preview Canvas & Toolbars -->
        <section class="studio-main-container" id="studio-main-container">
          <!-- PrintPreview component attaches here -->
        </section>
      </div>
    `;

    this.dropZone = appEl.querySelector('#main-drop-zone');
    this.fileInput = appEl.querySelector('#file-upload-input');

    const previewContainer = appEl.querySelector('#studio-main-container') as HTMLElement;
    this.printPreview = new PrintPreview(previewContainer, {
      images: this.images,
      layout: this.preferences.defaultLayout,
      paperSize: this.preferences.paperSize,
      orientation: this.preferences.orientation,
      margins: this.preferences.margins,
      showCuttingLines: this.preferences.showCuttingLines,
      showPageNumbers: this.preferences.showPageNumbers,
      onLayoutChange: (layout) => {
        this.preferences.defaultLayout = layout;
        savePreferences(this.preferences);
        this.printPreview?.updateProps({ layout });
      },
      onPaperChange: (paper) => {
        this.preferences.paperSize = paper;
        savePreferences(this.preferences);
        this.printPreview?.updateProps({ paperSize: paper });
      },
      onOrientationChange: (orient) => {
        this.preferences.orientation = orient;
        savePreferences(this.preferences);
        this.printPreview?.updateProps({ orientation: orient });
      },
      onMarginsChange: (margins) => {
        this.preferences.margins = margins;
        savePreferences(this.preferences);
        this.printPreview?.updateProps({ margins });
      },
      onCuttingLinesChange: (show) => {
        this.preferences.showCuttingLines = show;
        savePreferences(this.preferences);
        this.printPreview?.updateProps({ showCuttingLines: show });
      },
      onPageNumbersChange: (show) => {
        this.preferences.showPageNumbers = show;
        savePreferences(this.preferences);
        this.printPreview?.updateProps({ showPageNumbers: show });
      },
      onImageUpdated: (updated) => {
        const idx = this.images.findIndex(i => i.id === updated.id);
        if (idx !== -1) {
          this.images[idx] = updated;
          this.printPreview?.updateProps({ images: this.images });
        }
      },
      onOpenCrop: (image) => {
        this.cropModal.open(image);
      },
      onRemoveImage: (id) => {
        this.images = this.images.filter(i => i.id !== id);
        this.printPreview?.updateProps({ images: this.images });
      },
      onReorderImages: (newImages) => {
        this.images = newImages;
        this.printPreview?.updateProps({ images: this.images });
      }
    });
  }

  private bindGlobalEvents() {
    // Drop zone & File selection
    const btnBrowse = document.querySelector('#btn-select-files');
    btnBrowse?.addEventListener('click', () => this.fileInput?.click());

    this.fileInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.handleFiles(Array.from(files));
        this.fileInput!.value = '';
      }
    });

    if (this.dropZone) {
      this.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.dropZone?.classList.add('drag-over');
      });

      this.dropZone.addEventListener('dragleave', () => {
        this.dropZone?.classList.remove('drag-over');
      });

      this.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.dropZone?.classList.remove('drag-over');
        if (e.dataTransfer?.files) {
          this.handleFiles(Array.from(e.dataTransfer.files));
        }
      });
    }

    // Header Auto-crop toggle
    const headerAutoCrop = document.querySelector('#header-toggle-autocrop') as HTMLInputElement;
    headerAutoCrop?.addEventListener('change', () => {
      this.preferences.autoCropOnUpload = headerAutoCrop.checked;
      savePreferences(this.preferences);
      this.settingsModal.updatePreference('autoCropOnUpload', headerAutoCrop.checked);
      this.showToast(headerAutoCrop.checked ? 'Auto-crop enabled for all uploads' : 'Auto-crop turned off');
    });

    // Settings Modal
    document.querySelector('#btn-open-settings')?.addEventListener('click', () => {
      this.settingsModal.open();
    });

    // Clear all
    document.querySelector('#btn-clear-all')?.addEventListener('click', () => {
      if (this.images.length === 0) return;
      if (confirm('Clear all documents from the print queue?')) {
        this.images = [];
        this.printPreview?.updateProps({ images: [] });
      }
    });

    // Samples Menu Dropdown toggle
    const btnSamples = document.querySelector('#btn-samples-menu');
    const dropdown = document.querySelector('#samples-dropdown');
    btnSamples?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle('active');
    });
    window.addEventListener('click', () => {
      dropdown?.classList.remove('active');
    });

    // Sample Actions
    document.querySelector('#sample-item-invoice')?.addEventListener('click', () => {
      this.loadSampleInvoice(false);
      dropdown?.classList.remove('active');
    });

    document.querySelector('#sample-item-idcard')?.addEventListener('click', () => {
      this.loadSampleIdCards();
      dropdown?.classList.remove('active');
    });

    // Camera capture
    document.querySelector('#btn-camera-capture')?.addEventListener('click', () => {
      this.openCameraCapture();
    });

    // Theme Mode Toggle
    document.querySelector('#btn-toggle-theme')?.addEventListener('click', () => {
      const nextTheme = this.preferences.theme === 'light' ? 'dark' : 'light';
      this.preferences.theme = nextTheme;
      savePreferences(this.preferences);
      this.applyTheme(nextTheme);
      this.settingsModal.updatePreference('theme', nextTheme);
      this.showToast(`Switched to ${nextTheme === 'light' ? 'Light' : 'Dark'} Mode`);
    });
  }

  private applyTheme(theme: 'dark' | 'light') {
    document.documentElement.setAttribute('data-theme', theme);
    const iconEl = document.querySelector('#theme-btn-icon');
    const labelEl = document.querySelector('#theme-btn-label');
    if (iconEl && labelEl) {
      iconEl.textContent = theme === 'light' ? '🌙' : '☀️';
      labelEl.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
    }
  }

  private handlePreferencesChanged(newPrefs: AppPreferences) {
    this.preferences = newPrefs;
    this.applyTheme(newPrefs.theme);
    const headerToggle = document.querySelector('#header-toggle-autocrop') as HTMLInputElement;
    if (headerToggle) headerToggle.checked = newPrefs.autoCropOnUpload;

    this.printPreview?.updateProps({
      layout: newPrefs.defaultLayout,
      paperSize: newPrefs.paperSize,
      margins: newPrefs.margins,
      showCuttingLines: newPrefs.showCuttingLines,
      showPageNumbers: newPrefs.showPageNumbers
    });
  }

  private async handleFiles(files: File[]) {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      alert('Please upload image files (JPG, PNG, WEBP).');
      return;
    }

    for (const file of validFiles) {
      await this.processIncomingFile(file);
    }
  }

  private async processIncomingFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      await this.addImageToWorkspace(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  }

  private async addImageToWorkspace(dataUrl: string, name: string) {
    const imgEl = await loadImage(dataUrl);
    const origW = imgEl.naturalWidth || imgEl.width;
    const origH = imgEl.naturalHeight || imgEl.height;

    // Run automatic edge detection
    const detected = await detectDocumentEdges(imgEl);

    const newItem: ImageItem = {
      id: 'img_' + Math.random().toString(36).substr(2, 9),
      name: name,
      originalDataUrl: dataUrl,
      originalWidth: origW,
      originalHeight: origH,
      detectedCorners: detected,
      displayDataUrl: dataUrl,
      rotation: 0,
      filter: this.preferences.defaultFilter,
      brightness: 0,
      contrast: 0,
      isAutoCropped: false,
      aspectRatio: origW / origH
    };

    if (this.preferences.autoCropOnUpload) {
      // Automatic cropping as requested
      const warped = await warpPerspective(imgEl, detected);
      newItem.croppedDataUrl = warped.dataUrl;
      newItem.appliedCorners = detected;
      newItem.aspectRatio = warped.width / warped.height;
      newItem.isAutoCropped = true;

      // Apply auto-enhance if enabled
      if (this.preferences.autoEnhanceOnCrop) {
        const enhanced = await processImageEnhancement(
          warped.dataUrl,
          this.preferences.defaultFilter,
          0,
          0,
          0
        );
        newItem.displayDataUrl = enhanced.dataUrl;
      } else {
        newItem.displayDataUrl = warped.dataUrl;
      }

      this.images.push(newItem);
      this.printPreview?.updateProps({ images: this.images });

      // After cropping, ask whether to print 2 images in one A4 sheet
      if (this.preferences.askTwoUpPrompt) {
        this.layoutPromptModal.open(this.images.length);
      }
    } else {
      // Add and open Crop Modal for manual corner adjustments
      this.images.push(newItem);
      this.printPreview?.updateProps({ images: this.images });
      this.cropModal.open(newItem);
    }
  }

  private handleCropDone(croppedImage: ImageItem) {
    const idx = this.images.findIndex(i => i.id === croppedImage.id);
    if (idx !== -1) {
      this.images[idx] = croppedImage;
    }

    this.printPreview?.updateProps({ images: this.images });

    // After cropping, ask the user whether to print 2 images in one A4 sheet
    if (this.preferences.askTwoUpPrompt) {
      this.layoutPromptModal.open(this.images.length);
    }
  }

  private handleCropCancel() {
    this.printPreview?.updateProps({ images: this.images });
  }

  private handleLayoutPromptSelection(selectedLayout: LayoutMode, rememberChoice: boolean) {
    this.preferences.defaultLayout = selectedLayout;
    if (rememberChoice) {
      this.preferences.askTwoUpPrompt = false; // Remember choice and don't prompt every time
    }
    savePreferences(this.preferences);

    this.printPreview?.updateProps({
      layout: selectedLayout,
      images: this.images
    });

    this.showToast(`Applied layout: ${selectedLayout === '2-up-vertical' ? '2 Images in 1 A4 Sheet' : selectedLayout}`);
  }

  // --- Sample Generators ---
  private async loadSampleInvoice(isInitial = false) {
    const invoiceUrl = createSampleInvoice();
    await this.addImageToWorkspace(invoiceUrl, 'Store_Tax_Invoice_Sample.jpg');
    if (!isInitial) {
      this.showToast('Sample store receipt loaded!');
    }
  }

  private async loadSampleIdCards() {
    const frontUrl = createSampleIdCard('front');
    const backUrl = createSampleIdCard('back');

    await this.addImageToWorkspace(frontUrl, 'Metro_ID_Card_Front.jpg');
    await this.addImageToWorkspace(backUrl, 'Metro_ID_Card_Back.jpg');

    // Auto switch to 2-in-1 ID card duplex layout or 2-up
    this.printPreview?.updateProps({
      layout: 'id-card-duplex',
      images: this.images
    });
    this.showToast('Loaded Front & Back ID Card for 2-in-1 duplex printing!');
  }

  // --- Live Camera Viewfinder ---
  private async openCameraCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });

      const camModal = document.createElement('div');
      camModal.className = 'crop-modal-overlay active';
      camModal.innerHTML = `
        <div class="crop-modal-container" style="max-width: 680px;">
          <div class="crop-modal-header">
            <div class="crop-header-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <div>
                <h3>Camera Document Capture</h3>
                <p>Align document in frame and click Snap Photo.</p>
              </div>
            </div>
            <button id="btn-close-cam" class="btn-icon-close">✕</button>
          </div>
          <div class="camera-stream-wrapper">
            <video id="camera-video-element" autoplay playsinline muted></video>
            <div class="camera-guideline-box"></div>
          </div>
          <div class="crop-modal-footer">
            <button id="btn-cancel-cam" class="btn-secondary">Cancel</button>
            <button id="btn-snap-photo" class="btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Snap Photo
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(camModal);

      const video = camModal.querySelector('#camera-video-element') as HTMLVideoElement;
      video.srcObject = stream;

      const stopCam = () => {
        stream.getTracks().forEach(t => t.stop());
        camModal.remove();
      };

      camModal.querySelector('#btn-close-cam')?.addEventListener('click', stopCam);
      camModal.querySelector('#btn-cancel-cam')?.addEventListener('click', stopCam);

      camModal.querySelector('#btn-snap-photo')?.addEventListener('click', async () => {
        const snapCanvas = document.createElement('canvas');
        snapCanvas.width = video.videoWidth || 1280;
        snapCanvas.height = video.videoHeight || 720;
        const sCtx = snapCanvas.getContext('2d')!;
        sCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
        const shotUrl = snapCanvas.toDataURL('image/jpeg', 0.95);
        stopCam();
        await this.addImageToWorkspace(shotUrl, `Camera_Doc_${Date.now().toString().slice(-4)}.jpg`);
      });
    } catch (err) {
      console.warn('Camera access error:', err);
      alert('Camera access was not granted or is not available on this device.');
    }
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
    }, 2800);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
