import type { FilterType } from '../types';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Apply filters (Magic Clean, Document B&W, Grayscale, Vivid), Brightness, Contrast, and Rotation
 */
export async function processImageEnhancement(
  sourceUrl: string,
  filter: FilterType,
  brightness = 0, // -50 to +50
  contrast = 0,   // -50 to +50
  rotation = 0    // 0, 90, 180, 270
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(sourceUrl);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Compute canvas dimensions based on rotation
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const canvasW = isRotated90or270 ? origH : origW;
  const canvasH = isRotated90or270 ? origW : origH;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Cannot get 2d context');

  // Handle Rotation
  ctx.save();
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -origW / 2, -origH / 2);
  ctx.restore();

  // If no adjustments needed, return early
  if (filter === 'original' && brightness === 0 && contrast === 0) {
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.95),
      width: canvasW,
      height: canvasH
    };
  }

  const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imgData.data;
  const len = data.length;

  // Contrast factor: contrast range [-50, 50] mapped to [0.5, 2.0]
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const bOffset = brightness * 1.5;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Base Brightness and Contrast
    if (brightness !== 0) {
      r = Math.min(255, Math.max(0, r + bOffset));
      g = Math.min(255, Math.max(0, g + bOffset));
      b = Math.min(255, Math.max(0, b + bOffset));
    }

    if (contrast !== 0) {
      r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, factor * (b - 128) + 128));
    }

    // 2. Specific Document Filters
    if (filter === 'grayscale') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    } else if (filter === 'magic-bw') {
      // CamScanner Magic B&W Clean
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      // High-pass whitening: shadows and off-white background turned pure white, dark text deepened
      let val: number;
      if (gray > 165) {
        val = 255; // Crisp pure paper white
      } else if (gray < 85) {
        val = Math.max(0, gray * 0.7); // Deep black ink
      } else {
        // Linear steep curve between 85 and 165
        const norm = (gray - 85) / (165 - 85);
        val = Math.min(255, Math.max(0, Math.pow(norm, 1.8) * 255));
      }
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    } else if (filter === 'clean-doc') {
      // Whitens paper background while preserving subtle color headers/stamps
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 175) {
        // Whiten background
        const boost = (lum - 175) * 1.2;
        r = Math.min(255, r + boost);
        g = Math.min(255, g + boost);
        b = Math.min(255, b + boost);
      } else {
        // Deepen dark text
        r = Math.max(0, r * 0.88);
        g = Math.max(0, g * 0.88);
        b = Math.max(0, b * 0.88);
      }
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    } else if (filter === 'vivid') {
      // Boost color saturation and clarity
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = 1.35;
      data[i] = Math.min(255, Math.max(0, gray + sat * (r - gray)));
      data[i + 1] = Math.min(255, Math.max(0, gray + sat * (g - gray)));
      data[i + 2] = Math.min(255, Math.max(0, gray + sat * (b - gray)));
    } else {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.95),
    width: canvasW,
    height: canvasH
  };
}
