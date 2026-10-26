import type { Point, QuadPoints } from '../types';

function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Solve an 8x8 linear system A * h = b using Gaussian elimination with partial pivoting.
 */
function solve8x8(A: number[][], b: number[]): number[] | null {
  const n = 8;
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }

    if (Math.abs(A[maxRow][i]) < 1e-10) return null;

    // Swap rows
    const tmpA = A[i];
    A[i] = A[maxRow];
    A[maxRow] = tmpA;

    const tmpB = b[i];
    b[i] = b[maxRow];
    b[maxRow] = tmpB;

    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const c = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= c * A[i][j];
      }
      b[k] -= c * b[i];
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * x[j];
    }
    x[i] = sum / A[i][i];
  }

  return x;
}

/**
 * Computes the 3x3 Projective Homography Matrix mapping destination coordinates (0,0)-(W,H)
 * back to source quadrilateral coordinates (tl, tr, br, bl).
 * This allows backward mapping: for every destination pixel, find source coordinate (sx, sy).
 */
function getBackwardHomographyMatrix(srcQuad: QuadPoints, dstW: number, dstH: number): number[] | null {
  // Destination points:
  const dstPts: Point[] = [
    { x: 0, y: 0 },       // tl
    { x: dstW, y: 0 },    // tr
    { x: dstW, y: dstH }, // br
    { x: 0, y: dstH }     // bl
  ];

  const srcPts: Point[] = [
    srcQuad.tl,
    srcQuad.tr,
    srcQuad.br,
    srcQuad.bl
  ];

  // We want H that maps dst -> src (so we can loop over dst and sample from src)
  // [u, v, 1]^T -> [x, y, 1]^T
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const u = dstPts[i].x;
    const v = dstPts[i].y;
    const x = srcPts[i].x;
    const y = srcPts[i].y;

    // x = (h0*u + h1*v + h2) / (h6*u + h7*v + 1)
    // y = (h3*u + h4*v + h5) / (h6*u + h7*v + 1)
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);

    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  const h = solve8x8(A, b);
  if (!h) return null;

  return [
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], 1.0
  ];
}

/**
 * Checks if quad is approximately an axis-aligned bounding box
 */
function isAxisAligned(quad: QuadPoints, tolerance = 3): boolean {
  const isHorizTop = Math.abs(quad.tl.y - quad.tr.y) <= tolerance;
  const isHorizBot = Math.abs(quad.bl.y - quad.br.y) <= tolerance;
  const isVertLeft = Math.abs(quad.tl.x - quad.bl.x) <= tolerance;
  const isVertRight = Math.abs(quad.tr.x - quad.br.x) <= tolerance;
  return isHorizTop && isHorizBot && isVertLeft && isVertRight;
}

/**
 * Rectifies / perspective crops an image using quadrilateral corners
 */
export async function warpPerspective(
  sourceImage: HTMLImageElement,
  corners: QuadPoints
): Promise<{ dataUrl: string; width: number; height: number }> {
  const topW = distance(corners.tl, corners.tr);
  const botW = distance(corners.bl, corners.br);
  const leftH = distance(corners.tl, corners.bl);
  const rightH = distance(corners.tr, corners.br);

  const dstW = Math.max(50, Math.round((topW + botW) / 2));
  const dstH = Math.max(50, Math.round((leftH + rightH) / 2));

  // Create temporary source canvas to read pixels
  const srcW = sourceImage.naturalWidth || sourceImage.width;
  const srcH = sourceImage.naturalHeight || sourceImage.height;

  // Fast path: if approximately axis-aligned, use fast native 2D canvas drawImage
  if (isAxisAligned(corners)) {
    const minX = Math.max(0, Math.min(corners.tl.x, corners.bl.x));
    const minY = Math.max(0, Math.min(corners.tl.y, corners.tr.y));
    const maxX = Math.min(srcW, Math.max(corners.tr.x, corners.br.x));
    const maxY = Math.min(srcH, Math.max(corners.bl.y, corners.br.y));
    const cropW = Math.max(1, maxX - minX);
    const cropH = Math.max(1, maxY - minY);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = cropW;
    outCanvas.height = cropH;
    const outCtx = outCanvas.getContext('2d');
    if (outCtx) {
      outCtx.drawImage(sourceImage, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      return {
        dataUrl: outCanvas.toDataURL('image/jpeg', 0.95),
        width: cropW,
        height: cropH
      };
    }
  }

  // Perspective Homography Path
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) throw new Error('Cannot create source canvas context');
  srcCtx.drawImage(sourceImage, 0, 0);

  const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
  const srcPixels = srcImgData.data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = dstW;
  outCanvas.height = dstH;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) throw new Error('Cannot create output canvas context');

  const outImgData = outCtx.createImageData(dstW, dstH);
  const outPixels = outImgData.data;

  const H = getBackwardHomographyMatrix(corners, dstW, dstH);
  if (!H) {
    // Fallback to bounding box
    const minX = Math.max(0, Math.min(corners.tl.x, corners.tr.x, corners.br.x, corners.bl.x));
    const minY = Math.max(0, Math.min(corners.tl.y, corners.tr.y, corners.br.y, corners.bl.y));
    const maxX = Math.min(srcW, Math.max(corners.tl.x, corners.tr.x, corners.br.x, corners.bl.x));
    const maxY = Math.min(srcH, Math.max(corners.tl.y, corners.tr.y, corners.br.y, corners.bl.y));
    outCanvas.width = maxX - minX;
    outCanvas.height = maxY - minY;
    outCtx.drawImage(sourceImage, minX, minY, maxX - minX, maxY - minY, 0, 0, maxX - minX, maxY - minY);
    return {
      dataUrl: outCanvas.toDataURL('image/jpeg', 0.95),
      width: outCanvas.width,
      height: outCanvas.height
    };
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;

  // Bilinear interpolation warp
  let outIdx = 0;
  for (let v = 0; v < dstH; v++) {
    for (let u = 0; u < dstW; u++) {
      const denom = h6 * u + h7 * v + h8;
      const sx = (h0 * u + h1 * v + h2) / denom;
      const sy = (h3 * u + h4 * v + h5) / denom;

      if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const fx = sx - x0;
        const fy = sy - y0;
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        const idx00 = (y0 * srcW + x0) * 4;
        const idx10 = (y0 * srcW + x1) * 4;
        const idx01 = (y1 * srcW + x0) * 4;
        const idx11 = (y1 * srcW + x1) * 4;

        outPixels[outIdx]     = w00 * srcPixels[idx00]     + w10 * srcPixels[idx10]     + w01 * srcPixels[idx01]     + w11 * srcPixels[idx11];
        outPixels[outIdx + 1] = w00 * srcPixels[idx00 + 1] + w10 * srcPixels[idx10 + 1] + w01 * srcPixels[idx01 + 1] + w11 * srcPixels[idx11 + 1];
        outPixels[outIdx + 2] = w00 * srcPixels[idx00 + 2] + w10 * srcPixels[idx10 + 2] + w01 * srcPixels[idx01 + 2] + w11 * srcPixels[idx11 + 2];
        outPixels[outIdx + 3] = 255;
      } else {
        outPixels[outIdx] = 255;
        outPixels[outIdx + 1] = 255;
        outPixels[outIdx + 2] = 255;
        outPixels[outIdx + 3] = 255;
      }

      outIdx += 4;
    }
  }

  outCtx.putImageData(outImgData, 0, 0);

  return {
    dataUrl: outCanvas.toDataURL('image/jpeg', 0.95),
    width: dstW,
    height: dstH
  };
}
