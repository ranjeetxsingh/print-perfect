export interface Point {
  x: number;
  y: number;
}

export interface QuadPoints {
  tl: Point; // Top-Left
  tr: Point; // Top-Right
  br: Point; // Bottom-Right
  bl: Point; // Bottom-Left
}

export type FilterType = 'original' | 'magic-bw' | 'grayscale' | 'vivid' | 'clean-doc';

export type LayoutMode = '1-up' | '2-up-vertical' | '2-up-horizontal' | '4-up' | 'id-card-duplex';

export type PaperSize = 'a4' | 'letter' | 'legal';

export type PageOrientation = 'portrait' | 'landscape' | 'auto';

export type MarginOption = 'none' | 'narrow' | 'standard' | 'wide';

export interface AppPreferences {
  autoCropOnUpload: boolean;
  autoEnhanceOnCrop: boolean;
  defaultLayout: LayoutMode;
  paperSize: PaperSize;
  orientation: PageOrientation;
  margins: MarginOption;
  showCuttingLines: boolean;
  showPageNumbers: boolean;
  defaultFilter: FilterType;
  askTwoUpPrompt: boolean;
  theme: 'dark' | 'light';
}

export interface ImageItem {
  id: string;
  name: string;
  originalDataUrl: string;
  originalWidth: number;
  originalHeight: number;
  detectedCorners: QuadPoints;
  appliedCorners?: QuadPoints;
  croppedDataUrl?: string;
  displayDataUrl: string;
  rotation: number; // 0, 90, 180, 270
  filter: FilterType;
  brightness: number; // -50 to 50
  contrast: number; // -50 to 50
  isAutoCropped: boolean;
  aspectRatio: number; // width / height
}

export const PAPER_DIMENSIONS: Record<PaperSize, { widthMm: number; heightMm: number; name: string }> = {
  a4: { widthMm: 210, heightMm: 297, name: 'A4 (210 × 297 mm)' },
  letter: { widthMm: 215.9, heightMm: 279.4, name: 'US Letter (8.5 × 11 in)' },
  legal: { widthMm: 215.9, heightMm: 355.6, name: 'Legal (8.5 × 14 in)' }
};

export const MARGIN_VALUES: Record<MarginOption, number> = {
  none: 0,
  narrow: 5,
  standard: 12,
  wide: 20
};
