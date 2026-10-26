import type { LayoutMode } from '../types';

export class LayoutPromptModal {
  private overlay: HTMLElement;
  private onSelectLayout: (selectedLayout: LayoutMode, rememberChoice: boolean) => void;
  private onDismiss: () => void;

  constructor(options: {
    onSelectLayout: (selectedLayout: LayoutMode, rememberChoice: boolean) => void;
    onDismiss: () => void;
  }) {
    this.onSelectLayout = options.onSelectLayout;
    this.onDismiss = options.onDismiss;

    this.overlay = document.createElement('div');
    this.overlay.className = 'prompt-modal-overlay';
    this.render();
    document.body.appendChild(this.overlay);
    this.bindEvents();
  }

  public open(imageCount = 1) {
    this.render(imageCount);
    this.bindEvents();
    this.overlay.classList.add('active');
  }

  public close() {
    this.overlay.classList.remove('active');
    this.onDismiss();
  }

  private render(imageCount = 1) {
    this.overlay.innerHTML = `
      <div class="prompt-modal-container">
        <div class="prompt-modal-header">
          <div class="prompt-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28">
              <rect x="6" y="2" width="12" height="20" rx="2"/>
              <line x1="6" y1="12" x2="18" y2="12" stroke-dasharray="2 2"/>
            </svg>
          </div>
          <div>
            <h3>Sheet Layout Optimization</h3>
            <p>Document cropped & straightened successfully! Choose your preferred print layout.</p>
          </div>
          <button id="btn-prompt-close" class="btn-icon-close">✕</button>
        </div>

        <div class="prompt-modal-content">
          <div class="prompt-question-banner">
            <h4>Would you like to print 2 images in one A4 sheet?</h4>
            <p>Fitting 2 images per A4 page saves 50% paper, ink, and binds easily into binders or folders.</p>
          </div>

          <div class="prompt-options-grid">
            <!-- Option 1: 2 Images in 1 A4 (Top & Bottom) -->
            <div class="layout-card selected" data-layout="2-up-vertical">
              <div class="card-radio"></div>
              <div class="card-illustration">
                <div class="sheet-mockup">
                  <div class="doc-mockup-slot filled"></div>
                  <div class="cut-line-mockup"></div>
                  <div class="doc-mockup-slot filled"></div>
                </div>
              </div>
              <div class="card-info">
                <span class="card-tag">RECOMMENDED</span>
                <h5>Yes, 2 Images in 1 A4 Sheet</h5>
                <p>Stacked Top & Bottom. Perfect for receipts, invoices, certificates, and student notes.</p>
              </div>
            </div>

            <!-- Option 2: 2 Images Side-by-Side -->
            <div class="layout-card" data-layout="2-up-horizontal">
              <div class="card-radio"></div>
              <div class="card-illustration">
                <div class="sheet-mockup horizontal">
                  <div class="doc-mockup-slot filled"></div>
                  <div class="cut-line-mockup vertical"></div>
                  <div class="doc-mockup-slot filled"></div>
                </div>
              </div>
              <div class="card-info">
                <h5>2 Images Side-by-Side</h5>
                <p>Placed Left & Right across landscape or portrait A4. Great for comparison or books.</p>
              </div>
            </div>

            <!-- Option 3: 1 Image per Page -->
            <div class="layout-card" data-layout="1-up">
              <div class="card-radio"></div>
              <div class="card-illustration">
                <div class="sheet-mockup single">
                  <div class="doc-mockup-slot single-slot filled"></div>
                </div>
              </div>
              <div class="card-info">
                <h5>No, 1 Image per Sheet</h5>
                <p>Standard full-page print with comfortable safe margins for maximum readability.</p>
              </div>
            </div>

            <!-- Option 4: ID Card Duplex (Special) -->
            <div class="layout-card" data-layout="id-card-duplex">
              <div class="card-radio"></div>
              <div class="card-illustration">
                <div class="sheet-mockup id-card">
                  <div class="id-card-slot filled"></div>
                  <div class="cut-line-mockup"></div>
                  <div class="id-card-slot filled"></div>
                </div>
              </div>
              <div class="card-info">
                <span class="card-tag special">ID DUPLEX</span>
                <h5>2-in-1 ID Card Mode</h5>
                <p>Front & back placed at exact official ID card scale (85.6mm) on a single sheet.</p>
              </div>
            </div>
          </div>

          <div class="prompt-meta-row">
            <label class="remember-checkbox-label">
              <input type="checkbox" id="check-remember-choice" />
              <span>Remember this preference in Settings (don't ask again)</span>
            </label>
            <span class="badge-queue-count">${imageCount} document${imageCount > 1 ? 's' : ''} in queue</span>
          </div>
        </div>

        <div class="prompt-modal-footer">
          <button id="btn-prompt-skip" class="btn-secondary">Skip to Print Preview</button>
          <button id="btn-prompt-confirm" class="btn-primary">
            Apply Layout & View Sheet
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  private bindEvents() {
    const btnClose = this.overlay.querySelector('#btn-prompt-close');
    const btnSkip = this.overlay.querySelector('#btn-prompt-skip');
    const btnConfirm = this.overlay.querySelector('#btn-prompt-confirm');
    const cards = this.overlay.querySelectorAll('.layout-card');

    let currentSelected: LayoutMode = '2-up-vertical';

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        cards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        currentSelected = card.getAttribute('data-layout') as LayoutMode;
      });
    });

    btnClose?.addEventListener('click', () => this.close());
    btnSkip?.addEventListener('click', () => this.close());

    btnConfirm?.addEventListener('click', () => {
      const remember = (this.overlay.querySelector('#check-remember-choice') as HTMLInputElement)?.checked ?? false;
      this.overlay.classList.remove('active');
      this.onSelectLayout(currentSelected, remember);
    });
  }
}
