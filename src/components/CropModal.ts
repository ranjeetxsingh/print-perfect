import type { Point, QuadPoints, ImageItem } from '../types';
import { detectDocumentEdges } from '../utils/edgeDetector';
import { warpPerspective } from '../utils/perspectiveWarp';
import { loadImage } from '../utils/imageFilters';

export class CropModal {
  private overlay: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private loupeCanvas: HTMLCanvasElement;
  private loupeCtx: CanvasRenderingContext2D;
  private currentImage: ImageItem | null = null;
  private sourceImgElement: HTMLImageElement | null = null;
  private corners: QuadPoints = {
    tl: { x: 0, y: 0 },
    tr: { x: 0, y: 0 },
    br: { x: 0, y: 0 },
    bl: { x: 0, y: 0 }
  };
  private activeHandle: 'tl' | 'tr' | 'br' | 'bl' | 'top' | 'right' | 'bottom' | 'left' | 'all' | null = null;
  private dragStartPos: Point = { x: 0, y: 0 };
  private initialCorners: QuadPoints = {
    tl: { x: 0, y: 0 },
    tr: { x: 0, y: 0 },
    br: { x: 0, y: 0 },
    bl: { x: 0, y: 0 }
  };
  private displayScale = 1;
  private displayOffsetX = 0;
  private displayOffsetY = 0;
  private onCropDone: (updatedImage: ImageItem) => void;
  private onCancel: () => void;
  private isRectangularMode = false;

  constructor(options: {
    onCropDone: (updatedImage: ImageItem) => void;
    onCancel: () => void;
  }) {
    this.onCropDone = options.onCropDone;
    this.onCancel = options.onCancel;

    this.overlay = document.createElement('div');
    this.overlay.className = 'crop-modal-overlay';
    this.overlay.innerHTML = `
      <div class="crop-modal-container">
        <div class="crop-modal-header">
          <div class="crop-header-title">
            <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/>
              <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>
            </svg>
            <div>
              <h3>Adjust Edge Detection & Crop</h3>
              <p>Drag corner handles to align with document edges. Magnifier loupe provides pixel-level accuracy.</p>
            </div>
          </div>
          <div class="crop-header-actions">
            <button id="btn-re-detect" class="btn-subtle" title="Re-run automatic edge detection">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              AI Auto-Detect
            </button>
            <button id="btn-full-crop" class="btn-subtle" title="Select entire image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              </svg>
              Full Image
            </button>
            <button id="btn-rotate-img" class="btn-subtle" title="Rotate image 90° clockwise">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"/>
                <polyline points="21 3 21 8 16 8"/>
              </svg>
              Rotate 90°
            </button>
            <button id="btn-close-crop" class="btn-icon-close" title="Close without cropping">✕</button>
          </div>
        </div>

        <div class="crop-canvas-wrapper" id="crop-canvas-wrapper">
          <canvas id="crop-main-canvas"></canvas>
          <div class="crop-loupe" id="crop-loupe">
            <canvas id="crop-loupe-canvas" width="140" height="140"></canvas>
            <div class="loupe-crosshair"></div>
          </div>
          <div class="crop-guide-tip">
            <span>💡 Tip:</span> Hold and drag any corner pin to adjust perspective warping.
          </div>
        </div>

        <div class="crop-modal-footer">
          <div class="crop-footer-left">
            <label class="toggle-switch-label">
              <input type="checkbox" id="check-rect-mode" />
              <span>Rectangular Box Mode</span>
            </label>
          </div>
          <div class="crop-footer-right">
            <button id="btn-crop-cancel" class="btn-secondary">Cancel</button>
            <button id="btn-crop-apply" class="btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Apply Crop & Straighten
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.canvas = this.overlay.querySelector('#crop-main-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.loupeCanvas = this.overlay.querySelector('#crop-loupe-canvas') as HTMLCanvasElement;
    this.loupeCtx = this.loupeCanvas.getContext('2d')!;

    this.bindEvents();
  }

  private bindEvents() {
    const btnClose = this.overlay.querySelector('#btn-close-crop')!;
    const btnCancel = this.overlay.querySelector('#btn-crop-cancel')!;
    const btnApply = this.overlay.querySelector('#btn-crop-apply')!;
    const btnDetect = this.overlay.querySelector('#btn-re-detect')!;
    const btnFull = this.overlay.querySelector('#btn-full-crop')!;
    const btnRotate = this.overlay.querySelector('#btn-rotate-img')!;
    const checkRect = this.overlay.querySelector('#check-rect-mode') as HTMLInputElement;

    btnClose.addEventListener('click', () => this.close());
    btnCancel.addEventListener('click', () => this.close());
    btnApply.addEventListener('click', () => this.applyCrop());

    btnDetect.addEventListener('click', async () => {
      if (!this.sourceImgElement) return;
      btnDetect.classList.add('loading');
      const detected = await detectDocumentEdges(this.sourceImgElement);
      this.corners = detected;
      btnDetect.classList.remove('loading');
      this.draw();
    });

    btnFull.addEventListener('click', () => {
      if (!this.sourceImgElement) return;
      const w = this.sourceImgElement.naturalWidth || this.sourceImgElement.width;
      const h = this.sourceImgElement.naturalHeight || this.sourceImgElement.height;
      this.corners = {
        tl: { x: 0, y: 0 },
        tr: { x: w, y: 0 },
        br: { x: w, y: h },
        bl: { x: 0, y: h }
      };
      this.draw();
    });

    btnRotate.addEventListener('click', async () => {
      if (!this.currentImage || !this.sourceImgElement) return;
      // Rotate image 90 degrees in memory
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = this.sourceImgElement.naturalHeight;
      rotCanvas.height = this.sourceImgElement.naturalWidth;
      const rCtx = rotCanvas.getContext('2d')!;
      rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rCtx.rotate((90 * Math.PI) / 180);
      rCtx.drawImage(this.sourceImgElement, -this.sourceImgElement.naturalWidth / 2, -this.sourceImgElement.naturalHeight / 2);
      
      const newUrl = rotCanvas.toDataURL('image/jpeg', 0.95);
      this.currentImage.originalDataUrl = newUrl;
      this.currentImage.originalWidth = rotCanvas.width;
      this.currentImage.originalHeight = rotCanvas.height;
      this.sourceImgElement = await loadImage(newUrl);

      // Re-initialize corners
      const detected = await detectDocumentEdges(this.sourceImgElement);
      this.corners = detected;
      this.resizeCanvas();
      this.draw();
    });

    checkRect.addEventListener('change', (e) => {
      this.isRectangularMode = (e.target as HTMLInputElement).checked;
      if (this.isRectangularMode) {
        this.snapToRectangle();
      }
      this.draw();
    });

    // Pointer events on canvas
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    window.addEventListener('resize', () => {
      if (this.overlay.classList.contains('active')) {
        this.resizeCanvas();
        this.draw();
      }
    });
  }

  public async open(image: ImageItem) {
    this.currentImage = image;
    this.sourceImgElement = await loadImage(image.originalDataUrl);

    // If corners already exist, use them, otherwise use detected
    this.corners = image.appliedCorners ? { ...image.appliedCorners } : { ...image.detectedCorners };

    this.overlay.classList.add('active');
    setTimeout(() => {
      this.resizeCanvas();
      this.draw();
    }, 50);
  }

  public close() {
    this.overlay.classList.remove('active');
    this.hideLoupe();
    this.onCancel();
  }

  private resizeCanvas() {
    const wrapper = this.overlay.querySelector('#crop-canvas-wrapper') as HTMLElement;
    if (!wrapper || !this.sourceImgElement) return;

    const availableW = wrapper.clientWidth - 40;
    const availableH = wrapper.clientHeight - 40;

    const imgW = this.sourceImgElement.naturalWidth || this.sourceImgElement.width;
    const imgH = this.sourceImgElement.naturalHeight || this.sourceImgElement.height;

    const scaleW = availableW / imgW;
    const scaleH = availableH / imgH;
    this.displayScale = Math.min(scaleW, scaleH, 1.2);

    const canvasW = Math.round(imgW * this.displayScale);
    const canvasH = Math.round(imgH * this.displayScale);

    this.canvas.width = canvasW;
    this.canvas.height = canvasH;
    this.displayOffsetX = 0;
    this.displayOffsetY = 0;
  }

  private imgToCanvas(p: Point): Point {
    return {
      x: p.x * this.displayScale + this.displayOffsetX,
      y: p.y * this.displayScale + this.displayOffsetY
    };
  }



  private draw() {
    if (!this.sourceImgElement || !this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.clearRect(0, 0, w, h);

    // 1. Draw base image
    this.ctx.drawImage(this.sourceImgElement, 0, 0, w, h);

    const tl = this.imgToCanvas(this.corners.tl);
    const tr = this.imgToCanvas(this.corners.tr);
    const br = this.imgToCanvas(this.corners.br);
    const bl = this.imgToCanvas(this.corners.bl);

    // 2. Dim outside area with dark semi-transparent mask
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    this.ctx.beginPath();
    // Outer rect
    this.ctx.rect(0, 0, w, h);
    // Inner quadrilateral hole (counter-clockwise)
    this.ctx.moveTo(tl.x, tl.y);
    this.ctx.lineTo(bl.x, bl.y);
    this.ctx.lineTo(br.x, br.y);
    this.ctx.lineTo(tr.x, tr.y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();

    // 3. Draw quadrilateral border with glowing stroke
    this.ctx.save();
    this.ctx.strokeStyle = '#38bdf8'; // Sky blue
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.moveTo(tl.x, tl.y);
    this.ctx.lineTo(tr.x, tr.y);
    this.ctx.lineTo(br.x, br.y);
    this.ctx.lineTo(bl.x, bl.y);
    this.ctx.closePath();
    this.ctx.stroke();

    // Inner rule of thirds grid for alignment
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);

    for (let i = 1; i <= 2; i++) {
      const f = i / 3;
      // Horizontal grid lines
      const leftPt = { x: tl.x + (bl.x - tl.x) * f, y: tl.y + (bl.y - tl.y) * f };
      const rightPt = { x: tr.x + (br.x - tr.x) * f, y: tr.y + (br.y - tr.y) * f };
      this.ctx.beginPath();
      this.ctx.moveTo(leftPt.x, leftPt.y);
      this.ctx.lineTo(rightPt.x, rightPt.y);
      this.ctx.stroke();

      // Vertical grid lines
      const topPt = { x: tl.x + (tr.x - tl.x) * f, y: tl.y + (tr.y - tl.y) * f };
      const botPt = { x: bl.x + (br.x - bl.x) * f, y: bl.y + (br.y - bl.y) * f };
      this.ctx.beginPath();
      this.ctx.moveTo(topPt.x, topPt.y);
      this.ctx.lineTo(botPt.x, botPt.y);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]);
    this.ctx.restore();

    // 4. Draw corner pin handles
    this.drawCornerHandle(tl, 'tl');
    this.drawCornerHandle(tr, 'tr');
    this.drawCornerHandle(br, 'br');
    this.drawCornerHandle(bl, 'bl');

    // 5. Draw edge mid-point handles
    const midTop = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
    const midRight = { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 };
    const midBottom = { x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 };
    const midLeft = { x: (tl.x + bl.x) / 2, y: (tl.y + bl.y) / 2 };

    this.drawEdgeHandle(midTop);
    this.drawEdgeHandle(midRight);
    this.drawEdgeHandle(midBottom);
    this.drawEdgeHandle(midLeft);
  }

  private drawCornerHandle(p: Point, _id: string) {
    this.ctx.save();
    // Outer shadow ring
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    this.ctx.shadowBlur = 8;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    this.ctx.fill();

    // Inner colored ring
    this.ctx.shadowColor = 'transparent';
    this.ctx.fillStyle = '#0284c7'; // Deep sky blue
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawEdgeHandle(p: Point) {
    this.ctx.save();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#0284c7';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  private getHandleUnderPointer(canvasX: number, canvasY: number): string | null {
    const radius = 22; // Generous touch target
    const tl = this.imgToCanvas(this.corners.tl);
    const tr = this.imgToCanvas(this.corners.tr);
    const br = this.imgToCanvas(this.corners.br);
    const bl = this.imgToCanvas(this.corners.bl);

    if (Math.hypot(canvasX - tl.x, canvasY - tl.y) < radius) return 'tl';
    if (Math.hypot(canvasX - tr.x, canvasY - tr.y) < radius) return 'tr';
    if (Math.hypot(canvasX - br.x, canvasY - br.y) < radius) return 'br';
    if (Math.hypot(canvasX - bl.x, canvasY - bl.y) < radius) return 'bl';

    // Edge handles
    const midTop = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
    const midRight = { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 };
    const midBottom = { x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 };
    const midLeft = { x: (tl.x + bl.x) / 2, y: (tl.y + bl.y) / 2 };

    if (Math.hypot(canvasX - midTop.x, canvasY - midTop.y) < radius) return 'top';
    if (Math.hypot(canvasX - midRight.x, canvasY - midRight.y) < radius) return 'right';
    if (Math.hypot(canvasX - midBottom.x, canvasY - midBottom.y) < radius) return 'bottom';
    if (Math.hypot(canvasX - midLeft.x, canvasY - midLeft.y) < radius) return 'left';

    // Check inside quad for full move
    if (this.isPointInsideQuad(canvasX, canvasY, [tl, tr, br, bl])) {
      return 'all';
    }

    return null;
  }

  private isPointInsideQuad(x: number, y: number, pts: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private onPointerDown(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const handle = this.getHandleUnderPointer(cx, cy);
    if (!handle) return;

    this.activeHandle = handle as any;
    this.dragStartPos = { x: cx, y: cy };
    this.initialCorners = JSON.parse(JSON.stringify(this.corners));
    this.canvas.setPointerCapture(e.pointerId);

    if (handle === 'tl' || handle === 'tr' || handle === 'br' || handle === 'bl') {
      this.updateLoupe(this.corners[handle as 'tl' | 'tr' | 'br' | 'bl'], e.clientX, e.clientY);
    }
  }

  private onPointerMove(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (!this.activeHandle) {
      const handle = this.getHandleUnderPointer(cx, cy);
      if (handle === 'tl' || handle === 'br') this.canvas.style.cursor = 'nwse-resize';
      else if (handle === 'tr' || handle === 'bl') this.canvas.style.cursor = 'nesw-resize';
      else if (handle === 'top' || handle === 'bottom') this.canvas.style.cursor = 'ns-resize';
      else if (handle === 'left' || handle === 'right') this.canvas.style.cursor = 'ew-resize';
      else if (handle === 'all') this.canvas.style.cursor = 'move';
      else this.canvas.style.cursor = 'crosshair';
      return;
    }

    const dx = (cx - this.dragStartPos.x) / this.displayScale;
    const dy = (cy - this.dragStartPos.y) / this.displayScale;

    const maxW = this.sourceImgElement!.naturalWidth || this.sourceImgElement!.width;
    const maxH = this.sourceImgElement!.naturalHeight || this.sourceImgElement!.height;

    const clamp = (val: number, max: number) => Math.min(max, Math.max(0, val));

    if (this.activeHandle === 'tl') {
      this.corners.tl = {
        x: clamp(this.initialCorners.tl.x + dx, maxW),
        y: clamp(this.initialCorners.tl.y + dy, maxH)
      };
      if (this.isRectangularMode) {
        this.corners.bl.x = this.corners.tl.x;
        this.corners.tr.y = this.corners.tl.y;
      }
      this.updateLoupe(this.corners.tl, e.clientX, e.clientY);

    } else if (this.activeHandle === 'tr') {
      this.corners.tr = {
        x: clamp(this.initialCorners.tr.x + dx, maxW),
        y: clamp(this.initialCorners.tr.y + dy, maxH)
      };
      if (this.isRectangularMode) {
        this.corners.br.x = this.corners.tr.x;
        this.corners.tl.y = this.corners.tr.y;
      }
      this.updateLoupe(this.corners.tr, e.clientX, e.clientY);

    } else if (this.activeHandle === 'br') {
      this.corners.br = {
        x: clamp(this.initialCorners.br.x + dx, maxW),
        y: clamp(this.initialCorners.br.y + dy, maxH)
      };
      if (this.isRectangularMode) {
        this.corners.tr.x = this.corners.br.x;
        this.corners.bl.y = this.corners.br.y;
      }
      this.updateLoupe(this.corners.br, e.clientX, e.clientY);

    } else if (this.activeHandle === 'bl') {
      this.corners.bl = {
        x: clamp(this.initialCorners.bl.x + dx, maxW),
        y: clamp(this.initialCorners.bl.y + dy, maxH)
      };
      if (this.isRectangularMode) {
        this.corners.tl.x = this.corners.bl.x;
        this.corners.br.y = this.corners.bl.y;
      }
      this.updateLoupe(this.corners.bl, e.clientX, e.clientY);

    } else if (this.activeHandle === 'top') {
      this.corners.tl.y = clamp(this.initialCorners.tl.y + dy, maxH);
      this.corners.tr.y = clamp(this.initialCorners.tr.y + dy, maxH);
    } else if (this.activeHandle === 'bottom') {
      this.corners.bl.y = clamp(this.initialCorners.bl.y + dy, maxH);
      this.corners.br.y = clamp(this.initialCorners.br.y + dy, maxH);
    } else if (this.activeHandle === 'left') {
      this.corners.tl.x = clamp(this.initialCorners.tl.x + dx, maxW);
      this.corners.bl.x = clamp(this.initialCorners.bl.x + dx, maxW);
    } else if (this.activeHandle === 'right') {
      this.corners.tr.x = clamp(this.initialCorners.tr.x + dx, maxW);
      this.corners.br.x = clamp(this.initialCorners.br.x + dx, maxW);
    } else if (this.activeHandle === 'all') {
      // Move entire crop
      const allDx = dx;
      const allDy = dy;
      this.corners.tl = { x: clamp(this.initialCorners.tl.x + allDx, maxW), y: clamp(this.initialCorners.tl.y + allDy, maxH) };
      this.corners.tr = { x: clamp(this.initialCorners.tr.x + allDx, maxW), y: clamp(this.initialCorners.tr.y + allDy, maxH) };
      this.corners.br = { x: clamp(this.initialCorners.br.x + allDx, maxW), y: clamp(this.initialCorners.br.y + allDy, maxH) };
      this.corners.bl = { x: clamp(this.initialCorners.bl.x + allDx, maxW), y: clamp(this.initialCorners.bl.y + allDy, maxH) };
    }

    this.draw();
  }

  private onPointerUp() {
    this.activeHandle = null;
    this.hideLoupe();
  }

  private snapToRectangle() {
    const minX = Math.min(this.corners.tl.x, this.corners.bl.x);
    const maxX = Math.max(this.corners.tr.x, this.corners.br.x);
    const minY = Math.min(this.corners.tl.y, this.corners.tr.y);
    const maxY = Math.max(this.corners.bl.y, this.corners.br.y);

    this.corners = {
      tl: { x: minX, y: minY },
      tr: { x: maxX, y: minY },
      br: { x: maxX, y: maxY },
      bl: { x: minX, y: maxY }
    };
  }

  private updateLoupe(pointOnImage: Point, clientX: number, clientY: number) {
    if (!this.sourceImgElement) return;
    const loupe = this.overlay.querySelector('#crop-loupe') as HTMLElement;
    loupe.style.display = 'block';

    // Position loupe slightly above the finger/cursor
    const offsetX = 0;
    const offsetY = -95;
    loupe.style.left = `${clientX + offsetX}px`;
    loupe.style.top = `${clientY + offsetY}px`;

    // Draw magnified portion into loupeCanvas
    const zoom = 2.5;
    const lw = this.loupeCanvas.width;
    const lh = this.loupeCanvas.height;

    this.loupeCtx.clearRect(0, 0, lw, lh);
    const srcSize = lw / zoom;

    this.loupeCtx.drawImage(
      this.sourceImgElement,
      pointOnImage.x - srcSize / 2,
      pointOnImage.y - srcSize / 2,
      srcSize,
      srcSize,
      0,
      0,
      lw,
      lh
    );
  }

  private hideLoupe() {
    const loupe = this.overlay.querySelector('#crop-loupe') as HTMLElement;
    if (loupe) loupe.style.display = 'none';
  }

  private async applyCrop() {
    if (!this.currentImage || !this.sourceImgElement) return;

    const applyBtn = this.overlay.querySelector('#btn-crop-apply') as HTMLButtonElement;
    applyBtn.classList.add('loading');
    applyBtn.disabled = true;

    try {
      const warped = await warpPerspective(this.sourceImgElement, this.corners);

      this.currentImage.croppedDataUrl = warped.dataUrl;
      this.currentImage.displayDataUrl = warped.dataUrl;
      this.currentImage.appliedCorners = { ...this.corners };
      this.currentImage.aspectRatio = warped.width / warped.height;
      this.currentImage.isAutoCropped = false;

      this.overlay.classList.remove('active');
      this.hideLoupe();
      this.onCropDone(this.currentImage);
    } catch (err) {
      console.error('Perspective warp failed:', err);
      alert('Unable to apply crop with selected points. Please adjust corner points.');
    } finally {
      applyBtn.classList.remove('loading');
      applyBtn.disabled = false;
    }
  }
}
