export interface SizePreset {
  id: string;
  width: number;
  height: number;
  label: string;
  lockAspectRatio: boolean;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppState {
  originalImage: HTMLImageElement | null;
  originalFile: File | null;
  cropRect: CropRect | null;
  presets: SizePreset[];
  isProcessing: boolean;
  outputFormat: 'jpg' | 'png';
  jpgQuality: number;
}
