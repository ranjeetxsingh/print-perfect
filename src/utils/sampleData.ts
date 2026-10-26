/**
 * Generates sample test documents with realistic skew & borders
 * so the user can test edge detection, cropping, and 2-up printing instantly.
 */

export function createSampleInvoice(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d')!;

  // 1. Background (simulating a dark desk surface)
  ctx.fillStyle = '#262930';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Desk texture lines
  ctx.strokeStyle = '#323742';
  ctx.lineWidth = 1;
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // 2. Skewed paper receipt
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-0.06); // ~3.5 deg skew

  // Paper drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 10;
  ctx.shadowOffsetY = 15;

  const pw = 620;
  const ph = 960;
  ctx.fillStyle = '#fbfbfa';
  ctx.fillRect(-pw / 2, -ph / 2, pw, ph);

  // Turn off shadow for content
  ctx.shadowColor = 'transparent';

  // Receipt content
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('NEXUS DIGITAL STORE', 0, -ph / 2 + 70);

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('104 Cyber Park Blvd, Suite 400', 0, -ph / 2 + 100);
  ctx.fillText('Tel: (555) 019-2834 | Tax ID: 88-2940192', 0, -ph / 2 + 120);

  // Divider
  ctx.strokeStyle = '#e5e7eb';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(-pw / 2 + 40, -ph / 2 + 145);
  ctx.lineTo(pw / 2 - 40, -ph / 2 + 145);
  ctx.stroke();
  ctx.setLineDash([]);

  // Meta
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#374151';
  ctx.fillText('INVOICE #: INV-2026-8941', -pw / 2 + 40, -ph / 2 + 180);
  ctx.textAlign = 'right';
  ctx.fillText('DATE: 22-OCT-2026 14:32', pw / 2 - 40, -ph / 2 + 180);

  // Table items
  const items = [
    { desc: 'Wireless Ergonomic Mechanical Keyboard', qty: '1', price: '$129.00' },
    { desc: 'Ultra-HD 4K DisplayPort Cable (2m)', qty: '2', price: '$38.00' },
    { desc: 'USB-C Multiport Desktop Hub 100W', qty: '1', price: '$79.50' },
    { desc: 'Microfiber Screen Cleaning Cloths (3pk)', qty: '1', price: '$12.00' },
    { desc: 'Express Courier Delivery Service', qty: '1', price: '$15.00' }
  ];

  let currentY = -ph / 2 + 230;
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ITEM DESCRIPTION', -pw / 2 + 40, currentY);
  ctx.textAlign = 'center';
  ctx.fillText('QTY', pw / 2 - 130, currentY);
  ctx.textAlign = 'right';
  ctx.fillText('AMOUNT', pw / 2 - 40, currentY);

  currentY += 15;
  ctx.strokeStyle = '#d1d5db';
  ctx.beginPath();
  ctx.moveTo(-pw / 2 + 40, currentY);
  ctx.lineTo(pw / 2 - 40, currentY);
  ctx.stroke();

  currentY += 28;
  ctx.font = '13px sans-serif';
  for (const item of items) {
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'left';
    ctx.fillText(item.desc, -pw / 2 + 40, currentY);
    ctx.textAlign = 'center';
    ctx.fillText(item.qty, pw / 2 - 130, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(item.price, pw / 2 - 40, currentY);
    currentY += 32;
  }

  currentY += 20;
  ctx.strokeStyle = '#e5e7eb';
  ctx.beginPath();
  ctx.moveTo(-pw / 2 + 40, currentY);
  ctx.lineTo(pw / 2 - 40, currentY);
  ctx.stroke();

  currentY += 35;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Subtotal: $273.50', pw / 2 - 40, currentY);
  currentY += 25;
  ctx.fillText('Sales Tax (8.25%): $22.56', pw / 2 - 40, currentY);
  currentY += 32;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#111827';
  ctx.fillText('TOTAL PAID: $296.06', pw / 2 - 40, currentY);

  // Barcode
  currentY += 60;
  ctx.fillStyle = '#1f2937';
  for (let b = -pw / 2 + 80; b < pw / 2 - 80; b += Math.random() > 0.4 ? 8 : 4) {
    ctx.fillRect(b, currentY, Math.random() > 0.5 ? 3 : 1.5, 50);
  }

  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('* INV-2026-8941-X9 *', 0, currentY + 70);

  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.95);
}

export function createSampleIdCard(type: 'front' | 'back'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;

  // Background surface
  ctx.fillStyle = '#1a1d24';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(type === 'front' ? 0.04 : -0.04);

  // Card drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 10;

  const cw = 700;
  const ch = 440;
  const radius = 24;

  // Draw rounded card
  ctx.beginPath();
  ctx.roundRect(-cw / 2, -ch / 2, cw, ch, radius);
  ctx.fillStyle = type === 'front' ? '#0f172a' : '#1e293b';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  if (type === 'front') {
    // Header banner gradient
    const grad = ctx.createLinearGradient(-cw / 2, -ch / 2, cw / 2, -ch / 2 + 80);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = grad;
    ctx.fillRect(-cw / 2, -ch / 2, cw, 80);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GLOBAL METRO TRANSPORT PASS', -cw / 2 + 30, -ch / 2 + 48);

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('OFFICIAL IDENTITY', cw / 2 - 30, -ch / 2 + 48);

    // Photo placeholder
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-cw / 2 + 35, -ch / 2 + 115, 130, 165, 12);
    ctx.fill();

    // Silhouette
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(-cw / 2 + 100, -ch / 2 + 175, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-cw / 2 + 100, -ch / 2 + 250, 48, Math.PI, 0);
    ctx.fill();

    // Details
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALEXANDER MORGAN', -cw / 2 + 190, -ch / 2 + 145);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('CARDHOLDER ID', -cw / 2 + 190, -ch / 2 + 180);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('MET-849-0192-A', -cw / 2 + 190, -ch / 2 + 202);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('EXPIRES', -cw / 2 + 190, -ch / 2 + 235);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('12 / 2029 (ACTIVE)', -cw / 2 + 190, -ch / 2 + 255);

    // Smart chip
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(cw / 2 - 120, -ch / 2 + 120, 80, 60, 8);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.strokeRect(cw / 2 - 110, -ch / 2 + 130, 60, 40);

  } else {
    // Back of ID Card
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-cw / 2, -ch / 2 + 40, cw, 60); // Magnetic stripe

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('This card remains property of the Metropolitan Transit Authority.', -cw / 2 + 35, -ch / 2 + 140);
    ctx.fillText('If found, please drop in any postal mailbox or call 1-800-555-TRANSIT.', -cw / 2 + 35, -ch / 2 + 165);

    // Signature box
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-cw / 2 + 35, -ch / 2 + 190, 380, 50);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'italic 22px cursive, sans-serif';
    ctx.fillText('Alex Morgan', -cw / 2 + 55, -ch / 2 + 225);

    // Barcode
    for (let b = -cw / 2 + 35; b < cw / 2 - 35; b += 6) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(b, ch / 2 - 90, Math.random() > 0.4 ? 4 : 2, 45);
    }
  }

  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.95);
}
