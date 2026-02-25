import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { SizePreset, CropRect } from './types';

export class BatchProcessor {
  public async process(
    image: HTMLImageElement,
    userCrop: CropRect,
    presets: SizePreset[],
    format: 'jpg' | 'png',
    quality: number
  ): Promise<void> {
    const zip = new JSZip();
    const folder = zip.folder('resized_images');

    const promises = presets.map(async (preset) => {
      const blob = await this.generateImage(image, userCrop, preset, format, quality);
      if (blob) {
        const ext = format === 'jpg' ? 'jpg' : 'png';
        const filename = `${preset.label.replace(/\s+/g, '_')}_${preset.width}x${preset.height}.${ext}`;
        folder?.file(filename, blob);
      }
    });

    await Promise.all(promises);
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'images.zip');
  }

  private async generateImage(
    image: HTMLImageElement,
    userCrop: CropRect,
    preset: SizePreset,
    format: 'jpg' | 'png',
    quality: number
  ): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = preset.width;
    canvas.height = preset.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // 1. Calculate Target Crop Rect on Source Image
    // We want to preserve the center of userCrop
    const cx = userCrop.x + userCrop.width / 2;
    const cy = userCrop.y + userCrop.height / 2;

    const targetRatio = preset.width / preset.height;
    const userRatio = userCrop.width / userCrop.height;

    let sourceW, sourceH;

    // "Smart Auto-Fit": Expand user crop to match target aspect ratio
    // If target is wider than user crop, we need more width from source
    if (targetRatio > userRatio) {
      sourceH = userCrop.height;
      sourceW = sourceH * targetRatio;
    } else {
      // Target is taller, need more height
      sourceW = userCrop.width;
      sourceH = sourceW / targetRatio;
    }

    // Ensure we don't exceed image bounds (scale down if needed)
    if (sourceW > image.width) {
      sourceW = image.width;
      sourceH = sourceW / targetRatio;
    }
    if (sourceH > image.height) {
      sourceH = image.height;
      sourceW = sourceH * targetRatio;
    }

    // Center the new crop rect
    let sourceX = cx - sourceW / 2;
    let sourceY = cy - sourceH / 2;

    // Clamp to image bounds (shift if needed)
    if (sourceX < 0) sourceX = 0;
    if (sourceY < 0) sourceY = 0;
    if (sourceX + sourceW > image.width) sourceX = image.width - sourceW;
    if (sourceY + sourceH > image.height) sourceY = image.height - sourceH;

    // Draw
    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(
      image,
      sourceX, sourceY, sourceW, sourceH, // Source
      0, 0, preset.width, preset.height   // Destination
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        format === 'jpg' ? 'image/jpeg' : 'image/png',
        quality
      );
    });
  }
}
