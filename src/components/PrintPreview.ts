import type { ImageItem, LayoutMode, PaperSize, PageOrientation, MarginOption, FilterType } from '../types';
import { MARGIN_VALUES } from '../types';
import { generatePdf } from '../utils/pdfGenerator';
import { processImageEnhancement } from '../utils/imageFilters';

export interface PrintPreviewProps {
  images: ImageItem[];
  layout: LayoutMode;
  paperSize: PaperSize;
  orientation: PageOrientation;
  margins: MarginOption;
  showCuttingLines: boolean;
  showPageNumbers: boolean;
  onLayoutChange: (layout: LayoutMode) => void;
  onPaperChange: (paper: PaperSize) => void;
  onOrientationChange: (orient: PageOrientation) => void;
  onMarginsChange: (margins: MarginOption) => void;
  onCuttingLinesChange: (show: boolean) => void;
  onPageNumbersChange: (show: boolean) => void;
  onImageUpdated: (updatedImage: ImageItem) => void;
  onOpenCrop: (image: ImageItem) => void;
  onRemoveImage: (imageId: string) => void;
  onReorderImages: (newImages: ImageItem[]) => void;
}

export class PrintPreview {
  private container: HTMLElement;
  private props: PrintPreviewProps;
  private currentPage = 0;
  private activeImageId: string | null = null;
  private zoomLevel = 1.0;
  private draggedIndex: number | null = null;
  private sliderDebounceTimer: number | null = null;

  constructor(container: HTMLElement, props: PrintPreviewProps) {
    this.container = container;
    this.props = props;
    if (this.props.images.length > 0) {
      this.activeImageId = this.props.images[0].id;
    }
    this.render();
  }

  public updateProps(newProps: Partial<PrintPreviewProps>) {
    this.props = { ...this.props, ...newProps };
    if (this.props.images.length > 0) {
      const exists = this.props.images.some(img => img.id === this.activeImageId);
      if (!exists) {
        this.activeImageId = this.props.images[0].id;
      }
    } else {
      this.activeImageId = null;
    }
    this.render();
  }

  public render() {
    const { images, layout, paperSize, orientation, margins, showCuttingLines, showPageNumbers } = this.props;

    if (images.length === 0) {
      this.container.innerHTML = `
        <div class="empty-preview-state">
          <div class="empty-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="48" height="48">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <h3>No Documents in Queue</h3>
          <p>Upload or drag & drop documents, receipts, or photos above to start creating print-ready sheets.</p>
        </div>
      `;
      return;
    }

    const itemsPerPage = layout === '1-up' ? 1 : layout === '4-up' ? 4 : 2;
    const totalPages = Math.max(1, Math.ceil(images.length / itemsPerPage));
    if (this.currentPage >= totalPages) this.currentPage = totalPages - 1;

    const startIndex = this.currentPage * itemsPerPage;
    const currentSheetImages = images.slice(startIndex, startIndex + itemsPerPage);

    const activeImage = images.find(img => img.id === this.activeImageId) || images[0];

    this.container.innerHTML = `
      <div class="print-studio-layout">
        <!-- Top Toolbar: Quick layout, Paper, Orientation, Margins, Print buttons -->
        <header class="studio-topbar">
          <div class="topbar-section">
            <span class="toolbar-label">LAYOUT:</span>
            <div class="pill-group">
              <button class="pill-btn ${layout === '2-up-vertical' ? 'active' : ''}" data-layout="2-up-vertical" title="2 Images per A4 (Top & Bottom)">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M2 1a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2zm0 8a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H2z"/>
                </svg>
                2-Up (Stacked)
              </button>
              <button class="pill-btn ${layout === '2-up-horizontal' ? 'active' : ''}" data-layout="2-up-horizontal" title="2 Images per A4 (Side by Side)">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M1 2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm8 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V2z"/>
                </svg>
                2-Up (Side-by-Side)
              </button>
              <button class="pill-btn ${layout === '1-up' ? 'active' : ''}" data-layout="1-up" title="1 Image per Sheet (Full Page)">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/>
                </svg>
                1-Up (Single)
              </button>
              <button class="pill-btn ${layout === 'id-card-duplex' ? 'active' : ''}" data-layout="id-card-duplex" title="2-in-1 ID Card Duplex (85.6mm Scale)">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v1h14V4a1 1 0 0 0-1-1H2zm13 4H1v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7z"/>
                </svg>
                ID Card 2-in-1
              </button>
              <button class="pill-btn ${layout === '4-up' ? 'active' : ''}" data-layout="4-up" title="4 Images per Sheet (4-Up Grid)">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z"/>
                </svg>
                4-Up Grid
              </button>
            </div>
          </div>

          <div class="topbar-section">
            <span class="toolbar-label">PAPER:</span>
            <select id="select-paper-size" class="compact-select">
              <option value="a4" ${paperSize === 'a4' ? 'selected' : ''}>A4</option>
              <option value="letter" ${paperSize === 'letter' ? 'selected' : ''}>Letter</option>
              <option value="legal" ${paperSize === 'legal' ? 'selected' : ''}>Legal</option>
            </select>

            <span class="toolbar-label">ORIENT:</span>
            <div class="pill-group">
              <button class="icon-toggle-btn ${orientation === 'portrait' ? 'active' : ''}" id="btn-orient-portrait" title="Portrait orientation">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="2" width="14" height="20" rx="2"/>
                </svg>
              </button>
              <button class="icon-toggle-btn ${orientation === 'landscape' ? 'active' : ''}" id="btn-orient-landscape" title="Landscape orientation">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                </svg>
              </button>
            </div>

            <span class="toolbar-label">MARGIN:</span>
            <select id="select-margins" class="compact-select">
              <option value="none" ${margins === 'none' ? 'selected' : ''}>0mm (Border)</option>
              <option value="narrow" ${margins === 'narrow' ? 'selected' : ''}>5mm (Narrow)</option>
              <option value="standard" ${margins === 'standard' ? 'selected' : ''}>12mm (Std)</option>
              <option value="wide" ${margins === 'wide' ? 'selected' : ''}>20mm (Wide)</option>
            </select>
          </div>

          <div class="topbar-section actions">
            <button id="btn-export-pdf" class="btn-secondary" title="Export as High-Resolution Multi-page PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Save PDF
            </button>
            <button id="btn-print-now" class="btn-primary" title="Send directly to printer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print Now
            </button>
          </div>
        </header>

        <div class="studio-workspace">
          <!-- Left Sidebar: Documents Queue & Selected Image Fine-Tuning -->
          <aside class="studio-sidebar">
            <div class="sidebar-block">
              <div class="sidebar-header">
                <div class="sidebar-title-row">
                  <h4>Document Queue (${images.length})</h4>
                  <span class="subtext-hint">Drag handles to reorder sequence</span>
                </div>
              </div>
              <div class="doc-queue-list" id="doc-queue-list">
                ${images.map((img, idx) => `
                  <div class="doc-queue-item ${img.id === this.activeImageId ? 'active' : ''}" 
                       data-id="${img.id}" 
                       data-index="${idx}"
                       draggable="true">
                    
                    <!-- Drag handle -->
                    <div class="drag-grip-handle" title="Click & drag to reorder">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                        <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                        <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                      </svg>
                    </div>

                    <span class="queue-num">${idx + 1}</span>

                    <div class="queue-thumb">
                      <img src="${img.displayDataUrl}" alt="${img.name}" />
                    </div>

                    <div class="queue-details">
                      <span class="queue-name" title="${img.name}">${img.name}</span>
                      <div class="queue-badges">
                        <span class="badge ${img.appliedCorners ? 'badge-blue' : 'badge-gray'}">
                          ${img.appliedCorners ? 'Cropped' : 'Original'}
                        </span>
                        <span class="badge badge-purple">${img.filter}</span>
                      </div>
                    </div>

                    <div class="queue-actions">
                      <!-- Quick reorder up/down buttons -->
                      <button class="btn-queue-action btn-move-up" title="Move Up" data-index="${idx}" ${idx === 0 ? 'disabled' : ''}>▲</button>
                      <button class="btn-queue-action btn-move-down" title="Move Down" data-index="${idx}" ${idx === images.length - 1 ? 'disabled' : ''}>▼</button>
                      <button class="btn-queue-action btn-recrop" title="Re-adjust edge crop" data-id="${img.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                          <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/>
                          <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>
                        </svg>
                      </button>
                      <button class="btn-queue-action text-danger btn-delete" title="Remove" data-id="${img.id}">✕</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            ${activeImage ? `
              <!-- Active Document Tools & Enhancements -->
              <div class="sidebar-block active-tools-block">
                <div class="sidebar-header">
                  <h4>Document Enhancements</h4>
                  <span class="subtext">For: ${activeImage.name}</span>
                </div>

                <div class="filter-buttons-grid">
                  <button class="filter-chip ${activeImage.filter === 'clean-doc' ? 'active' : ''}" data-filter="clean-doc" title="Whiten paper background and sharpen text">
                    <span class="filter-icon">📄</span>
                    <span>Clean Doc</span>
                  </button>
                  <button class="filter-chip ${activeImage.filter === 'magic-bw' ? 'active' : ''}" data-filter="magic-bw" title="High-contrast CamScanner black & white">
                    <span class="filter-icon">✨</span>
                    <span>Magic B&W</span>
                  </button>
                  <button class="filter-chip ${activeImage.filter === 'grayscale' ? 'active' : ''}" data-filter="grayscale" title="Save colored ink">
                    <span class="filter-icon">🖨️</span>
                    <span>Ink Saver</span>
                  </button>
                  <button class="filter-chip ${activeImage.filter === 'vivid' ? 'active' : ''}" data-filter="vivid" title="Boost saturation for diagrams and photos">
                    <span class="filter-icon">🎨</span>
                    <span>Vivid Color</span>
                  </button>
                  <button class="filter-chip ${activeImage.filter === 'original' ? 'active' : ''}" data-filter="original" title="Unmodified original photo">
                    <span class="filter-icon">📷</span>
                    <span>Original</span>
                  </button>
                </div>

                <!-- Sliders for Brightness & Contrast -->
                <div class="enhancement-sliders">
                  <div class="slider-control">
                    <div class="slider-label">
                      <span>Brightness</span>
                      <span id="label-brightness-val">${activeImage.brightness > 0 ? '+' : ''}${activeImage.brightness}</span>
                    </div>
                    <input type="range" id="slider-brightness" min="-50" max="50" value="${activeImage.brightness}" />
                  </div>
                  <div class="slider-control">
                    <div class="slider-label">
                      <span>Contrast</span>
                      <span id="label-contrast-val">${activeImage.contrast > 0 ? '+' : ''}${activeImage.contrast}</span>
                    </div>
                    <input type="range" id="slider-contrast" min="-50" max="50" value="${activeImage.contrast}" />
                  </div>
                </div>

                <!-- Rotation & Recrop Actions -->
                <div class="sidebar-row-actions">
                  <button id="btn-rotate-active" class="btn-subtle" title="Rotate 90 degrees clockwise">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"/>
                      <polyline points="21 3 21 8 16 8"/>
                    </svg>
                    Rotate 90°
                  </button>
                  <button id="btn-recrop-active" class="btn-subtle" title="Adjust Crop & Corners">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/>
                      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>
                    </svg>
                    Adjust Crop
                  </button>
                </div>
              </div>
            ` : ''}

            <!-- Sheet Options Toggles -->
            <div class="sidebar-block">
              <div class="sidebar-header">
                <h4>Print Marks & Guides</h4>
              </div>
              <div class="toggle-row">
                <label for="check-cut-lines">Scissor / Cutting Lines</label>
                <input type="checkbox" id="check-cut-lines" ${showCuttingLines ? 'checked' : ''} />
              </div>
              <div class="toggle-row">
                <label for="check-page-num">Page Numbers Footer</label>
                <input type="checkbox" id="check-page-num" ${showPageNumbers ? 'checked' : ''} />
              </div>
            </div>
          </aside>

          <!-- Main Stage: Realistic A4 Sheet Canvas Preview -->
          <main class="sheet-stage" id="sheet-stage">
            <div class="sheet-viewport" style="transform: scale(${this.zoomLevel});">
              <div class="paper-sheet paper-${paperSize} ${orientation}" id="printable-sheet" style="--margin-mm: ${MARGIN_VALUES[margins]}mm;">
                <!-- Printable Sheet Content -->
                <div class="sheet-printable-area ${layout}">
                  ${this.renderSheetLayout(currentSheetImages, layout, showCuttingLines)}
                </div>

                ${showPageNumbers ? `
                  <div class="sheet-footer">
                    Page ${this.currentPage + 1} of ${totalPages} • PrintPerfect Studio
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Floating Stage Controls: Pagination & Zoom -->
            <div class="stage-floating-bar">
              <div class="pagination-controls">
                <button id="btn-prev-page" class="btn-icon" ${this.currentPage === 0 ? 'disabled' : ''} title="Previous Page">◀</button>
                <span class="page-indicator">Sheet ${this.currentPage + 1} of ${totalPages}</span>
                <button id="btn-next-page" class="btn-icon" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''} title="Next Page">▶</button>
              </div>

              <div class="zoom-controls">
                <button id="btn-zoom-out" class="btn-icon" title="Zoom out">−</button>
                <span class="zoom-indicator">${Math.round(this.zoomLevel * 100)}%</span>
                <button id="btn-zoom-in" class="btn-icon" title="Zoom in">+</button>
                <button id="btn-zoom-reset" class="btn-icon" title="Fit to screen">Fit</button>
              </div>
            </div>
          </main>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderSheetLayout(images: ImageItem[], layout: LayoutMode, showCuttingLines: boolean): string {
    if (layout === '1-up') {
      const img = images[0];
      if (!img) return '<div class="sheet-slot empty">Empty Slot</div>';
      return `
        <div class="sheet-slot single-slot">
          <img src="${img.displayDataUrl}" alt="${img.name}" />
        </div>
      `;
    }

    if (layout === '2-up-vertical') {
      return `
        <div class="slot-container two-up-vertical">
          <div class="sheet-slot half-slot-v">
            ${images[0] ? `<img src="${images[0].displayDataUrl}" alt="${images[0].name}" />` : '<div class="empty-hint">1st document slot</div>'}
          </div>
          ${showCuttingLines ? '<div class="cutting-divider horizontal"><span class="scissor-icon">✂</span></div>' : ''}
          <div class="sheet-slot half-slot-v">
            ${images[1] ? `<img src="${images[1].displayDataUrl}" alt="${images[1].name}" />` : '<div class="empty-hint">+ Upload 2nd image for 2-in-1 print</div>'}
          </div>
        </div>
      `;
    }

    if (layout === '2-up-horizontal') {
      return `
        <div class="slot-container two-up-horizontal">
          <div class="sheet-slot half-slot-h">
            ${images[0] ? `<img src="${images[0].displayDataUrl}" alt="${images[0].name}" />` : '<div class="empty-hint">Slot 1</div>'}
          </div>
          ${showCuttingLines ? '<div class="cutting-divider vertical"><span class="scissor-icon">✂</span></div>' : ''}
          <div class="sheet-slot half-slot-h">
            ${images[1] ? `<img src="${images[1].displayDataUrl}" alt="${images[1].name}" />` : '<div class="empty-hint">+ 2nd Document</div>'}
          </div>
        </div>
      `;
    }

    if (layout === 'id-card-duplex') {
      return `
        <div class="slot-container id-card-duplex-container">
          <div class="id-card-placement-frame">
            <span class="id-card-badge">FRONT (85.6mm × 54mm)</span>
            <div class="id-card-slot-box ${showCuttingLines ? 'with-guides' : ''}">
              ${images[0] ? `<img src="${images[0].displayDataUrl}" alt="ID Front" />` : '<div class="empty-hint">ID Card Front</div>'}
            </div>
          </div>
          ${showCuttingLines ? '<div class="cutting-divider horizontal dashed-center"><span class="scissor-icon">✂ Fold / Cut Line</span></div>' : ''}
          <div class="id-card-placement-frame">
            <span class="id-card-badge">BACK (85.6mm × 54mm)</span>
            <div class="id-card-slot-box ${showCuttingLines ? 'with-guides' : ''}">
              ${images[1] ? `<img src="${images[1].displayDataUrl}" alt="ID Back" />` : '<div class="empty-hint">+ ID Card Back</div>'}
            </div>
          </div>
        </div>
      `;
    }

    if (layout === '4-up') {
      return `
        <div class="slot-container four-up-grid">
          ${[0, 1, 2, 3].map(idx => `
            <div class="sheet-slot quarter-slot">
              ${images[idx] ? `<img src="${images[idx].displayDataUrl}" alt="${images[idx].name}" />` : `<div class="empty-hint">Slot ${idx + 1}</div>`}
            </div>
          `).join('')}
          ${showCuttingLines ? `
            <div class="cutting-cross-h"><span class="scissor-icon">✂</span></div>
            <div class="cutting-cross-v"><span class="scissor-icon">✂</span></div>
          ` : ''}
        </div>
      `;
    }

    return '';
  }

  private bindEvents() {
    // Layout pills
    this.container.querySelectorAll('.pill-btn[data-layout]').forEach(btn => {
      btn.addEventListener('click', () => {
        const l = btn.getAttribute('data-layout') as LayoutMode;
        this.props.onLayoutChange(l);
      });
    });

    // Paper size
    const paperSelect = this.container.querySelector('#select-paper-size') as HTMLSelectElement;
    paperSelect?.addEventListener('change', () => {
      this.props.onPaperChange(paperSelect.value as PaperSize);
    });

    // Orientation
    this.container.querySelector('#btn-orient-portrait')?.addEventListener('click', () => {
      this.props.onOrientationChange('portrait');
    });
    this.container.querySelector('#btn-orient-landscape')?.addEventListener('click', () => {
      this.props.onOrientationChange('landscape');
    });

    // Margins
    const marginsSelect = this.container.querySelector('#select-margins') as HTMLSelectElement;
    marginsSelect?.addEventListener('change', () => {
      this.props.onMarginsChange(marginsSelect.value as MarginOption);
    });

    // Cutting lines & Page numbers
    const cutCheck = this.container.querySelector('#check-cut-lines') as HTMLInputElement;
    cutCheck?.addEventListener('change', () => {
      this.props.onCuttingLinesChange(cutCheck.checked);
    });

    const pageNumCheck = this.container.querySelector('#check-page-num') as HTMLInputElement;
    pageNumCheck?.addEventListener('change', () => {
      this.props.onPageNumbersChange(pageNumCheck.checked);
    });

    // Queue selection
    this.container.querySelectorAll('.doc-queue-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.queue-actions') || (e.target as HTMLElement).closest('.drag-grip-handle')) return;
        const id = item.getAttribute('data-id');
        if (id) {
          this.activeImageId = id;
          this.render();
        }
      });
    });

    // HTML5 Drag and Drop Reordering
    const queueItems = this.container.querySelectorAll<HTMLElement>('.doc-queue-item');

    queueItems.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const idxStr = item.getAttribute('data-index');
        if (idxStr !== null) {
          this.draggedIndex = parseInt(idxStr, 10);
          item.classList.add('is-dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', idxStr);
          }
        }
      });

      item.addEventListener('dragend', () => {
        this.draggedIndex = null;
        item.classList.remove('is-dragging');
        queueItems.forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          item.classList.add('drag-over-top');
          item.classList.remove('drag-over-bottom');
        } else {
          item.classList.add('drag-over-bottom');
          item.classList.remove('drag-over-top');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over-top', 'drag-over-bottom');
        const targetIdxStr = item.getAttribute('data-index');
        if (this.draggedIndex !== null && targetIdxStr !== null) {
          const targetIndex = parseInt(targetIdxStr, 10);
          if (this.draggedIndex !== targetIndex) {
            const reordered = [...this.props.images];
            const [moved] = reordered.splice(this.draggedIndex, 1);
            reordered.splice(targetIndex, 0, moved);
            this.props.onReorderImages(reordered);
          }
        }
        this.draggedIndex = null;
      });
    });

    // Quick Move Up / Down button events
    this.container.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index') || '-1', 10);
        if (idx > 0) {
          const reordered = [...this.props.images];
          const temp = reordered[idx - 1];
          reordered[idx - 1] = reordered[idx];
          reordered[idx] = temp;
          this.props.onReorderImages(reordered);
        }
      });
    });

    this.container.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index') || '-1', 10);
        if (idx >= 0 && idx < this.props.images.length - 1) {
          const reordered = [...this.props.images];
          const temp = reordered[idx + 1];
          reordered[idx + 1] = reordered[idx];
          reordered[idx] = temp;
          this.props.onReorderImages(reordered);
        }
      });
    });

    // Recrop & Delete buttons
    this.container.querySelectorAll('.btn-recrop').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const img = this.props.images.find(i => i.id === id);
        if (img) this.props.onOpenCrop(img);
      });
    });

    this.container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) this.props.onRemoveImage(id);
      });
    });

    // Active document tools
    const activeImage = this.props.images.find(img => img.id === this.activeImageId);

    // Filters with immediate enhancement processing
    this.container.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        if (!activeImage) return;
        const filter = chip.getAttribute('data-filter') as FilterType;
        activeImage.filter = filter;
        this.container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        await this.reprocessActiveImage(activeImage);
      });
    });

    // Sliders with debounced live preview on input and full apply on change
    const brightnessSlider = this.container.querySelector('#slider-brightness') as HTMLInputElement;
    const contrastSlider = this.container.querySelector('#slider-contrast') as HTMLInputElement;

    brightnessSlider?.addEventListener('input', () => {
      if (!activeImage) return;
      activeImage.brightness = parseInt(brightnessSlider.value, 10);
      const valLabel = this.container.querySelector('#label-brightness-val');
      if (valLabel) valLabel.textContent = `${activeImage.brightness > 0 ? '+' : ''}${activeImage.brightness}`;

      if (this.sliderDebounceTimer) clearTimeout(this.sliderDebounceTimer);
      this.sliderDebounceTimer = window.setTimeout(async () => {
        await this.reprocessActiveImage(activeImage, false);
      }, 50);
    });

    brightnessSlider?.addEventListener('change', async () => {
      if (!activeImage) return;
      await this.reprocessActiveImage(activeImage);
    });

    contrastSlider?.addEventListener('input', () => {
      if (!activeImage) return;
      activeImage.contrast = parseInt(contrastSlider.value, 10);
      const valLabel = this.container.querySelector('#label-contrast-val');
      if (valLabel) valLabel.textContent = `${activeImage.contrast > 0 ? '+' : ''}${activeImage.contrast}`;

      if (this.sliderDebounceTimer) clearTimeout(this.sliderDebounceTimer);
      this.sliderDebounceTimer = window.setTimeout(async () => {
        await this.reprocessActiveImage(activeImage, false);
      }, 50);
    });

    contrastSlider?.addEventListener('change', async () => {
      if (!activeImage) return;
      await this.reprocessActiveImage(activeImage);
    });

    // Rotate active
    this.container.querySelector('#btn-rotate-active')?.addEventListener('click', async () => {
      if (!activeImage) return;
      activeImage.rotation = (activeImage.rotation + 90) % 360;
      await this.reprocessActiveImage(activeImage);
    });

    // Recrop active
    this.container.querySelector('#btn-recrop-active')?.addEventListener('click', () => {
      if (activeImage) this.props.onOpenCrop(activeImage);
    });

    // Pagination
    this.container.querySelector('#btn-prev-page')?.addEventListener('click', () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.render();
      }
    });

    this.container.querySelector('#btn-next-page')?.addEventListener('click', () => {
      this.currentPage++;
      this.render();
    });

    // Zoom controls
    this.container.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      this.zoomLevel = Math.min(1.8, this.zoomLevel + 0.15);
      const vp = this.container.querySelector('.sheet-viewport') as HTMLElement;
      if (vp) vp.style.transform = `scale(${this.zoomLevel})`;
      const ind = this.container.querySelector('.zoom-indicator');
      if (ind) ind.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    });

    this.container.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      this.zoomLevel = Math.max(0.4, this.zoomLevel - 0.15);
      const vp = this.container.querySelector('.sheet-viewport') as HTMLElement;
      if (vp) vp.style.transform = `scale(${this.zoomLevel})`;
      const ind = this.container.querySelector('.zoom-indicator');
      if (ind) ind.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    });

    this.container.querySelector('#btn-zoom-reset')?.addEventListener('click', () => {
      this.zoomLevel = 1.0;
      const vp = this.container.querySelector('.sheet-viewport') as HTMLElement;
      if (vp) vp.style.transform = `scale(${this.zoomLevel})`;
      const ind = this.container.querySelector('.zoom-indicator');
      if (ind) ind.textContent = `100%`;
    });

    // Export PDF
    this.container.querySelector('#btn-export-pdf')?.addEventListener('click', () => {
      generatePdf(this.props.images, {
        layout: this.props.layout,
        paperSize: this.props.paperSize,
        orientation: this.props.orientation === 'auto' ? 'portrait' : this.props.orientation,
        marginOption: this.props.margins,
        showCuttingLines: this.props.showCuttingLines,
        showPageNumbers: this.props.showPageNumbers
      });
    });

    // Direct Browser Print
    this.container.querySelector('#btn-print-now')?.addEventListener('click', () => {
      window.print();
    });
  }

  private async reprocessActiveImage(image: ImageItem, fullRender = true) {
    const baseSource = image.croppedDataUrl || image.originalDataUrl;
    const processed = await processImageEnhancement(
      baseSource,
      image.filter,
      image.brightness,
      image.contrast,
      image.rotation
    );
    image.displayDataUrl = processed.dataUrl;
    image.aspectRatio = processed.width / processed.height;
    this.props.onImageUpdated(image);

    if (fullRender) {
      this.render();
    } else {
      // Fast path: update image in sheet preview and queue thumbnail without rebuilding the whole DOM
      const sheetImg = this.container.querySelector(`.sheet-printable-area img[alt="${image.name}"]`) as HTMLImageElement;
      if (sheetImg) sheetImg.src = processed.dataUrl;
      const thumb = this.container.querySelector(`.doc-queue-item[data-id="${image.id}"] .queue-thumb img`) as HTMLImageElement;
      if (thumb) thumb.src = processed.dataUrl;
    }
  }
}
