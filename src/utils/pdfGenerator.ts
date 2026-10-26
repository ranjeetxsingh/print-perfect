import { jsPDF } from 'jspdf';
import type { ImageItem, LayoutMode, PaperSize, MarginOption } from '../types';
import { MARGIN_VALUES, PAPER_DIMENSIONS } from '../types';

export interface PdfExportOptions {
  layout: LayoutMode;
  paperSize: PaperSize;
  orientation: 'portrait' | 'landscape';
  marginOption: MarginOption;
  showCuttingLines: boolean;
  showPageNumbers: boolean;
  filename?: string;
}

export async function generatePdf(
  images: ImageItem[],
  options: PdfExportOptions
): Promise<void> {
  if (images.length === 0) return;

  const paper = PAPER_DIMENSIONS[options.paperSize];
  const isLandscape = options.orientation === 'landscape';
  const pageWidth = isLandscape ? paper.heightMm : paper.widthMm;
  const pageHeight = isLandscape ? paper.widthMm : paper.heightMm;
  const margin = MARGIN_VALUES[options.marginOption];

  const doc = new jsPDF({
    orientation: options.orientation,
    unit: 'mm',
    format: [paper.widthMm, paper.heightMm]
  });

  const printableW = pageWidth - margin * 2;
  const printableH = pageHeight - margin * 2;

  // Determine items per page
  let itemsPerPage = 1;
  if (options.layout === '2-up-vertical' || options.layout === '2-up-horizontal' || options.layout === 'id-card-duplex') {
    itemsPerPage = 2;
  } else if (options.layout === '4-up') {
    itemsPerPage = 4;
  }

  const totalPages = Math.ceil(images.length / itemsPerPage);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage([paper.widthMm, paper.heightMm], options.orientation);
    }

    const startIndex = pageIdx * itemsPerPage;
    const pageImages = images.slice(startIndex, startIndex + itemsPerPage);

    if (options.layout === '1-up') {
      const img = pageImages[0];
      const imgAspect = img.aspectRatio || 1;
      const pageAspect = printableW / printableH;

      let drawW = printableW;
      let drawH = printableH;
      if (imgAspect > pageAspect) {
        drawW = printableW;
        drawH = printableW / imgAspect;
      } else {
        drawH = printableH;
        drawW = printableH * imgAspect;
      }

      const drawX = margin + (printableW - drawW) / 2;
      const drawY = margin + (printableH - drawH) / 2;

      doc.addImage(img.displayDataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');

    } else if (options.layout === '2-up-vertical') {
      // 2 images stacked vertically (Top & Bottom)
      const slotH = (printableH - 6) / 2; // 6mm gap
      const slotW = printableW;

      pageImages.forEach((img, idx) => {
        const slotY = margin + idx * (slotH + 6);
        const imgAspect = img.aspectRatio || 1;
        const slotAspect = slotW / slotH;

        let drawW = slotW;
        let drawH = slotH;
        if (imgAspect > slotAspect) {
          drawW = slotW;
          drawH = slotW / imgAspect;
        } else {
          drawH = slotH;
          drawW = slotH * imgAspect;
        }

        const drawX = margin + (slotW - drawW) / 2;
        const drawY = slotY + (slotH - drawH) / 2;
        doc.addImage(img.displayDataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');
      });

      // Cutting guide line in the middle
      if (options.showCuttingLines && pageImages.length > 1) {
        const midY = margin + slotH + 3;
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([3, 3], 0);
        doc.line(margin / 2, midY, pageWidth - margin / 2, midY);
        doc.setLineDashPattern([], 0);
      }

    } else if (options.layout === '2-up-horizontal') {
      // 2 images side-by-side
      const slotW = (printableW - 6) / 2; // 6mm gap
      const slotH = printableH;

      pageImages.forEach((img, idx) => {
        const slotX = margin + idx * (slotW + 6);
        const imgAspect = img.aspectRatio || 1;
        const slotAspect = slotW / slotH;

        let drawW = slotW;
        let drawH = slotH;
        if (imgAspect > slotAspect) {
          drawW = slotW;
          drawH = slotW / imgAspect;
        } else {
          drawH = slotH;
          drawW = slotH * imgAspect;
        }

        const drawX = slotX + (slotW - drawW) / 2;
        const drawY = margin + (slotH - drawH) / 2;
        doc.addImage(img.displayDataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');
      });

      if (options.showCuttingLines && pageImages.length > 1) {
        const midX = margin + slotW + 3;
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([3, 3], 0);
        doc.line(midX, margin / 2, midX, pageHeight - margin / 2);
        doc.setLineDashPattern([], 0);
      }

    } else if (options.layout === 'id-card-duplex') {
      // Standard ISO ID-1 card dimensions: 85.60 mm × 53.98 mm
      const cardW = 85.6;
      const cardH = 53.98;
      const gap = 12;

      // Center both cards vertically on the A4 page
      const totalBlockH = cardH * 2 + gap;
      const startY = (pageHeight - totalBlockH) / 2;
      const startX = (pageWidth - cardW) / 2;

      pageImages.forEach((img, idx) => {
        const y = startY + idx * (cardH + gap);
        doc.addImage(img.displayDataUrl, 'JPEG', startX, y, cardW, cardH, undefined, 'FAST');

        // Optional corner guide marks
        if (options.showCuttingLines) {
          doc.setDrawColor(160, 160, 160);
          doc.setLineDashPattern([2, 2], 0);
          doc.rect(startX, y, cardW, cardH);
          doc.setLineDashPattern([], 0);
        }
      });

      // Central fold / cut line
      if (options.showCuttingLines) {
        const midY = startY + cardH + gap / 2;
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([3, 3], 0);
        doc.line(startX - 20, midY, startX + cardW + 20, midY);
        doc.setLineDashPattern([], 0);
      }

    } else if (options.layout === '4-up') {
      // 2x2 grid
      const slotW = (printableW - 6) / 2;
      const slotH = (printableH - 6) / 2;

      pageImages.forEach((img, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const slotX = margin + col * (slotW + 6);
        const slotY = margin + row * (slotH + 6);

        const imgAspect = img.aspectRatio || 1;
        const slotAspect = slotW / slotH;

        let drawW = slotW;
        let drawH = slotH;
        if (imgAspect > slotAspect) {
          drawW = slotW;
          drawH = slotW / imgAspect;
        } else {
          drawH = slotH;
          drawW = slotH * imgAspect;
        }

        const drawX = slotX + (slotW - drawW) / 2;
        const drawY = slotY + (slotH - drawH) / 2;
        doc.addImage(img.displayDataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'FAST');
      });

      if (options.showCuttingLines) {
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([3, 3], 0);
        // Vertical divider
        doc.line(margin + slotW + 3, margin / 2, margin + slotW + 3, pageHeight - margin / 2);
        // Horizontal divider
        doc.line(margin / 2, margin + slotH + 3, pageWidth - margin / 2, margin + slotH + 3);
        doc.setLineDashPattern([], 0);
      }
    }

    // Page number footer
    if (options.showPageNumbers) {
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${pageIdx + 1} of ${totalPages} • PrintPerfect`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    }
  }

  const filename = options.filename || `PrintPerfect_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
