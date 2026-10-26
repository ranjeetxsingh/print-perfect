import type { Point, QuadPoints } from '../types';

/**
 * Computes 2D cross product of OA and OB vectors.
 * Returns > 0 for counter-clockwise turn, < 0 for clockwise, 0 for collinear.
 */
function crossProduct(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Computes the Convex Hull of a 2D point cloud using Monotone Chain algorithm.
 * O(N log N) complexity, runs in < 2ms for downscaled edge clouds.
 */
function computeConvexHull(points: Point[]): Point[] {
  if (points.length <= 4) return points;

  // Sort points primarily by x, then by y
  const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

  // Build lower hull
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Build upper hull
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Concatenate lower and upper hull (remove duplicates at ends)
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Calculates quadrilateral area using Shoelace formula
 */
function computeQuadArea(p1: Point, p2: Point, p3: Point, p4: Point): number {
  return 0.5 * Math.abs(
    (p1.x * p2.y - p2.x * p1.y) +
    (p2.x * p3.y - p3.x * p2.y) +
    (p3.x * p4.y - p4.x * p3.y) +
    (p4.x * p1.y - p1.x * p4.y)
  );
}

/**
 * Computes the angle in degrees between vectors (p1 -> p2) and (p2 -> p3)
 */
function computeCornerAngleDeg(p1: Point, p2: Point, p3: Point): number {
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (mag1 < 1e-6 || mag2 < 1e-6) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Checks whether a quadrilateral is convex and all 4 angles are realistic for a document (50° - 130°)
 */
function isValidDocumentQuad(pts: Point[]): boolean {
  if (pts.length !== 4) return false;

  // Check convexity via cross product signs
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % 4];
    const p2 = pts[(i + 2) % 4];
    const cp = crossProduct(p0, p1, p2);
    if (Math.abs(cp) > 1e-5) {
      const currentSign = cp > 0 ? 1 : -1;
      if (sign === 0) sign = currentSign;
      else if (sign !== currentSign) return false; // Non-convex!
    }

    // Check angle
    const angle = computeCornerAngleDeg(p0, p1, p2);
    if (angle < 45 || angle > 135) return false;
  }

  return true;
}

/**
 * Organizes 4 arbitrary convex quadrilateral points into Top-Left, Top-Right, Bottom-Right, Bottom-Left
 */
function orderQuadCorners(pts: Point[]): QuadPoints {
  // Compute centroid
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  // Sort points by polar angle relative to centroid
  const sorted = [...pts].sort((a, b) => {
    const angA = Math.atan2(a.y - cy, a.x - cx);
    const angB = Math.atan2(b.y - cy, b.x - cx);
    return angA - angB;
  });

  // Find Top-Left: point with minimum (x + y)
  let bestTlIdx = 0;
  let minSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      bestTlIdx = i;
    }
  }

  // Re-index clockwise starting from Top-Left
  const tl = sorted[bestTlIdx];
  const tr = sorted[(bestTlIdx + 1) % 4];
  const br = sorted[(bestTlIdx + 2) % 4];
  const bl = sorted[(bestTlIdx + 3) % 4];

  // Verify that TR is genuinely right of TL, and BL is genuinely below TL
  if (tr.x < bl.x && tr.y > bl.y) {
    // Rotated counter-clockwise: swap tr and bl
    return { tl, tr: bl, br, bl: tr };
  }

  return { tl, tr, br, bl };
}

/**
 * Enhanced Computer-Vision Document Edge Detector
 * 1. 5x5 smoothing to suppress text characters while highlighting paper borders
 * 2. Sobel edge magnitude computation
 * 3. Otsu + dynamic thresholding
 * 4. Convex Hull construction
 * 5. Maximum Area Quadrilateral optimization with interior angle verification
 */
export async function detectDocumentEdges(imageElement: HTMLImageElement): Promise<QuadPoints> {
  const origW = imageElement.naturalWidth || imageElement.width;
  const origH = imageElement.naturalHeight || imageElement.height;

  // Safe fallback: 3% inset
  const defaultQuad: QuadPoints = {
    tl: { x: Math.round(origW * 0.03), y: Math.round(origH * 0.03) },
    tr: { x: Math.round(origW * 0.97), y: Math.round(origH * 0.03) },
    br: { x: Math.round(origW * 0.97), y: Math.round(origH * 0.97) },
    bl: { x: Math.round(origW * 0.03), y: Math.round(origH * 0.97) }
  };

  try {
    const maxDim = 450;
    let scale = 1;
    if (origW > maxDim || origH > maxDim) {
      scale = maxDim / Math.max(origW, origH);
    }
    const procW = Math.max(60, Math.round(origW * scale));
    const procH = Math.max(60, Math.round(origH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = procW;
    canvas.height = procH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return defaultQuad;

    ctx.drawImage(imageElement, 0, 0, procW, procH);
    const imgData = ctx.getImageData(0, 0, procW, procH);
    const data = imgData.data;

    // 1. Grayscale
    const gray = new Float32Array(procW * procH);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // 2. 5x5 Gaussian/Separable Blur (blurs text strokes so only outer document boundary dominates)
    const blurred = new Float32Array(procW * procH);
    const tempBlur = new Float32Array(procW * procH);
    const k1d = [1/16, 4/16, 6/16, 4/16, 1/16]; // 5-tap binomial weights

    // Horizontal pass
    for (let y = 0; y < procH; y++) {
      const rowOffset = y * procW;
      for (let x = 2; x < procW - 2; x++) {
        tempBlur[rowOffset + x] =
          gray[rowOffset + x - 2] * k1d[0] +
          gray[rowOffset + x - 1] * k1d[1] +
          gray[rowOffset + x]     * k1d[2] +
          gray[rowOffset + x + 1] * k1d[3] +
          gray[rowOffset + x + 2] * k1d[4];
      }
    }

    // Vertical pass
    for (let y = 2; y < procH - 2; y++) {
      for (let x = 2; x < procW - 2; x++) {
        blurred[y * procW + x] =
          tempBlur[(y - 2) * procW + x] * k1d[0] +
          tempBlur[(y - 1) * procW + x] * k1d[1] +
          tempBlur[y * procW + x]       * k1d[2] +
          tempBlur[(y + 1) * procW + x] * k1d[3] +
          tempBlur[(y + 2) * procW + x] * k1d[4];
      }
    }

    // 3. Sobel Gradient Magnitude
    const gradient = new Float32Array(procW * procH);
    let maxGrad = 0;
    const histogram = new Uint32Array(256);

    for (let y = 3; y < procH - 3; y++) {
      for (let x = 3; x < procW - 3; x++) {
        const gx =
          -1 * blurred[(y - 1) * procW + (x - 1)] + 1 * blurred[(y - 1) * procW + (x + 1)] +
          -2 * blurred[y * procW + (x - 1)]       + 2 * blurred[y * procW + (x + 1)] +
          -1 * blurred[(y + 1) * procW + (x - 1)] + 1 * blurred[(y + 1) * procW + (x + 1)];

        const gy =
          -1 * blurred[(y - 1) * procW + (x - 1)] - 2 * blurred[(y - 1) * procW + x] - 1 * blurred[(y - 1) * procW + (x + 1)] +
           1 * blurred[(y + 1) * procW + (x - 1)] + 2 * blurred[(y + 1) * procW + x] + 1 * blurred[(y + 1) * procW + (x + 1)];

        const mag = Math.sqrt(gx * gx + gy * gy);
        gradient[y * procW + x] = mag;
        if (mag > maxGrad) maxGrad = mag;

        const bin = Math.min(255, Math.floor(mag));
        histogram[bin]++;
      }
    }

    if (maxGrad < 12) {
      return defaultQuad; // Uniform flat document
    }

    // 4. Otsu's thresholding
    const totalPixels = (procW - 6) * (procH - 6);
    let sumTotal = 0;
    for (let t = 0; t < 256; t++) sumTotal += t * histogram[t];

    let sumBack = 0;
    let weightBack = 0;
    let maxVariance = 0;
    let threshold = 30;

    for (let t = 0; t < 256; t++) {
      weightBack += histogram[t];
      if (weightBack === 0) continue;
      const weightFore = totalPixels - weightBack;
      if (weightFore === 0) break;

      sumBack += t * histogram[t];
      const meanBack = sumBack / weightBack;
      const meanFore = (sumTotal - sumBack) / weightFore;
      const variance = weightBack * weightFore * (meanBack - meanFore) * (meanBack - meanFore);

      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }

    threshold = Math.max(16, Math.min(threshold * 1.05, 120));

    // 5. Collect candidate edge points (ignore 4px outer rim to avoid camera sensor edge lines)
    const edgePoints: Point[] = [];
    for (let y = 5; y < procH - 5; y++) {
      for (let x = 5; x < procW - 5; x++) {
        if (gradient[y * procW + x] >= threshold) {
          edgePoints.push({ x, y });
        }
      }
    }

    if (edgePoints.length < 40) {
      return defaultQuad;
    }

    // 6. Compute Convex Hull of edge points
    const hull = computeConvexHull(edgePoints);
    if (hull.length < 4) {
      return defaultQuad;
    }

    // Subsample hull if too large for combinatorial search
    let sampleHull = hull;
    if (sampleHull.length > 36) {
      const step = Math.ceil(sampleHull.length / 36);
      sampleHull = sampleHull.filter((_, idx) => idx % step === 0);
    }

    const n = sampleHull.length;
    let bestQuad: Point[] | null = null;
    let maxQuadArea = 0;
    const totalArea = procW * procH;

    // Search for the 4 hull vertices that maximize quadrilateral area and form a valid document
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          for (let l = k + 1; l < n; l++) {
            const p1 = sampleHull[i];
            const p2 = sampleHull[j];
            const p3 = sampleHull[k];
            const p4 = sampleHull[l];

            const qArea = computeQuadArea(p1, p2, p3, p4);
            if (qArea > maxQuadArea && qArea >= totalArea * 0.15 && qArea <= totalArea * 0.98) {
              const testQuad = [p1, p2, p3, p4];
              if (isValidDocumentQuad(testQuad)) {
                maxQuadArea = qArea;
                bestQuad = testQuad;
              }
            }
          }
        }
      }
    }

    // Fallback: If combinatorial search didn't find a valid quad, use extremal projection points
    if (!bestQuad) {
      let minSum = Infinity, maxSum = -Infinity;
      let minDiff = Infinity, maxDiff = -Infinity;
      let pTl = hull[0], pTr = hull[0], pBr = hull[0], pBl = hull[0];

      for (const pt of hull) {
        const sum = pt.x + pt.y;
        const diff = pt.x - pt.y;
        if (sum < minSum) { minSum = sum; pTl = pt; }
        if (sum > maxSum) { maxSum = sum; pBr = pt; }
        if (diff > maxDiff) { maxDiff = diff; pTr = pt; }
        if (diff < minDiff) { minDiff = diff; pBl = pt; }
      }

      const fallbackArea = computeQuadArea(pTl, pTr, pBr, pBl);
      if (fallbackArea >= totalArea * 0.15) {
        bestQuad = [pTl, pTr, pBr, pBl];
      }
    }

    if (!bestQuad) {
      return defaultQuad;
    }

    // Sort corners into clockwise TL, TR, BR, BL
    const ordered = orderQuadCorners(bestQuad);

    // Map back to full original image coordinates
    const invScale = 1 / scale;
    const clampX = (val: number) => Math.min(origW, Math.max(0, Math.round(val * invScale)));
    const clampY = (val: number) => Math.min(origH, Math.max(0, Math.round(val * invScale)));

    return {
      tl: { x: clampX(ordered.tl.x), y: clampY(ordered.tl.y) },
      tr: { x: clampX(ordered.tr.x), y: clampY(ordered.tr.y) },
      br: { x: clampX(ordered.br.x), y: clampY(ordered.br.y) },
      bl: { x: clampX(ordered.bl.x), y: clampY(ordered.bl.y) }
    };
  } catch (err) {
    console.warn('Advanced edge detection fallback:', err);
    return defaultQuad;
  }
}
