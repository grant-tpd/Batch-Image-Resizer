import { CropRect } from './types';

export class CropEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private cropRect: CropRect | null = null;
  
  private isDragging = false;
  private dragStart: { x: number; y: number } | null = null;
  private dragMode: 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | 'pan' | null = null;
  
  // Viewport State
  private view = { zoom: 1, panX: 0, panY: 0 };
  private onCropChange: (rect: CropRect) => void;

  constructor(canvas: HTMLCanvasElement, onCropChange: (rect: CropRect) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onCropChange = onCropChange;
    this.setupEvents();
  }

  public setImage(img: HTMLImageElement) {
    this.image = img;
    this.view = { zoom: 1, panX: 0, panY: 0 }; // Reset view
    
    // Default crop: center square 80% of min dimension
    const minDim = Math.min(img.width, img.height);
    const size = minDim * 0.8;
    this.cropRect = {
      x: (img.width - size) / 2,
      y: (img.height - size) / 2,
      width: size,
      height: size,
    };
    this.onCropChange(this.cropRect);
    this.render();
  }

  public getCropRect(): CropRect | null {
    return this.cropRect;
  }

  private setupEvents() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
      }
    }, { passive: false });
    
    window.addEventListener('touchmove', (e) => {
       if (this.isDragging) e.preventDefault();
       const touch = e.touches[0];
       this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
    }, { passive: false });

    window.addEventListener('touchend', () => {
       this.handleMouseUp();
    });
  }

  // --- Coordinate Systems ---

  // 1. Mouse (Client) -> Canvas Pixel Space
  private getMouseCanvasPos(e: { clientX: number, clientY: number }) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  // 2. Image Space -> Canvas Pixel Space
  private imageToCanvas(imgX: number, imgY: number) {
    if (!this.image) return { x: 0, y: 0 };
    
    const baseScale = this.getBaseScale();
    const totalScale = baseScale * this.view.zoom;
    
    // Center of canvas
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    
    // Image center relative to image top-left
    const imgCx = this.image.width / 2;
    const imgCy = this.image.height / 2;
    
    return {
      x: cx + this.view.panX + (imgX - imgCx) * totalScale,
      y: cy + this.view.panY + (imgY - imgCy) * totalScale
    };
  }

  // 3. Canvas Pixel Space -> Image Space
  private canvasToImage(canvasX: number, canvasY: number) {
    if (!this.image) return { x: 0, y: 0 };

    const baseScale = this.getBaseScale();
    const totalScale = baseScale * this.view.zoom;
    
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const imgCx = this.image.width / 2;
    const imgCy = this.image.height / 2;

    return {
      x: imgCx + (canvasX - cx - this.view.panX) / totalScale,
      y: imgCy + (canvasY - cy - this.view.panY) / totalScale
    };
  }

  private getBaseScale() {
    if (!this.image) return 1;
    const margin = 40; // Padding around image
    const w = this.canvas.width - margin * 2;
    const h = this.canvas.height - margin * 2;
    if (w <= 0 || h <= 0) return 1;
    return Math.min(w / this.image.width, h / this.image.height);
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (!this.image) return;

    const zoomIntensity = 0.1;
    const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
    const newZoom = Math.max(0.1, Math.min(10, this.view.zoom * (1 + delta)));

    // Zoom towards mouse pointer
    const mouse = this.getMouseCanvasPos(e);
    const imgPosBefore = this.canvasToImage(mouse.x, mouse.y);
    
    this.view.zoom = newZoom;
    
    // Adjust pan to keep imgPos under mouse
    // New canvas pos of that img point:
    // x = cx + panX + (imgX - imgCx) * scale
    // We want x to be mouse.x
    // panX = mouse.x - cx - (imgX - imgCx) * scale
    
    const baseScale = this.getBaseScale();
    const totalScale = baseScale * this.view.zoom;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const imgCx = this.image.width / 2;
    const imgCy = this.image.height / 2;

    this.view.panX = mouse.x - cx - (imgPosBefore.x - imgCx) * totalScale;
    this.view.panY = mouse.y - cy - (imgPosBefore.y - imgCy) * totalScale;

    this.render();
  }

  private handleMouseDown(e: MouseEvent) {
    if (!this.image || !this.cropRect) return;

    const mouse = this.getMouseCanvasPos(e);
    
    // Check handles first
    const cropCanvas = this.imageToCanvas(this.cropRect.x, this.cropRect.y);
    const cropBottomRight = this.imageToCanvas(this.cropRect.x + this.cropRect.width, this.cropRect.y + this.cropRect.height);
    
    const cropW = cropBottomRight.x - cropCanvas.x;
    const cropH = cropBottomRight.y - cropCanvas.y;
    
    const handleSize = 12; // Slightly larger hit area
    
    const hit = (x: number, y: number) => {
      return Math.abs(mouse.x - x) < handleSize && Math.abs(mouse.y - y) < handleSize;
    };

    // Handles
    if (hit(cropCanvas.x, cropCanvas.y)) this.dragMode = 'resize-tl';
    else if (hit(cropCanvas.x + cropW, cropCanvas.y)) this.dragMode = 'resize-tr';
    else if (hit(cropCanvas.x, cropCanvas.y + cropH)) this.dragMode = 'resize-bl';
    else if (hit(cropCanvas.x + cropW, cropCanvas.y + cropH)) this.dragMode = 'resize-br';
    // Body
    else if (
      mouse.x > cropCanvas.x && mouse.x < cropCanvas.x + cropW &&
      mouse.y > cropCanvas.y && mouse.y < cropCanvas.y + cropH
    ) {
      this.dragMode = 'move';
    } 
    // Background -> Pan
    else {
      this.dragMode = 'pan';
    }

    this.isDragging = true;
    this.dragStart = { x: mouse.x, y: mouse.y };
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isDragging || !this.image || !this.cropRect || !this.dragMode || !this.dragStart) return;

    const mouse = this.getMouseCanvasPos(e);
    
    if (this.dragMode === 'pan') {
        const dx = mouse.x - this.dragStart.x;
        const dy = mouse.y - this.dragStart.y;
        this.view.panX += dx;
        this.view.panY += dy;
        this.dragStart = { x: mouse.x, y: mouse.y };
        this.render();
        return;
    }

    const currentImg = this.canvasToImage(mouse.x, mouse.y);
    const startImg = this.canvasToImage(this.dragStart.x, this.dragStart.y);
    
    const dx = currentImg.x - startImg.x;
    const dy = currentImg.y - startImg.y;

    if (this.dragMode === 'move') {
        this.cropRect.x += dx;
        this.cropRect.y += dy;
        
        // Clamp
        this.cropRect.x = Math.max(0, Math.min(this.image.width - this.cropRect.width, this.cropRect.x));
        this.cropRect.y = Math.max(0, Math.min(this.image.height - this.cropRect.height, this.cropRect.y));
        
        this.dragStart = { x: mouse.x, y: mouse.y }; // Reset drag start to avoid accumulation errors if we wanted, but here we used delta from last frame effectively by resetting dragStart
    } else {
        // Resize logic
        // We need to handle corners. 
        // Simple approach: calculate new rect based on mouse pos and fixed opposite corner.
        
        let fixedX, fixedY;
        
        if (this.dragMode === 'resize-br') {
            fixedX = this.cropRect.x;
            fixedY = this.cropRect.y;
            this.cropRect.width = Math.max(10, currentImg.x - fixedX);
            this.cropRect.height = Math.max(10, currentImg.y - fixedY);
        } else if (this.dragMode === 'resize-tl') {
            fixedX = this.cropRect.x + this.cropRect.width;
            fixedY = this.cropRect.y + this.cropRect.height;
            const newX = Math.min(fixedX - 10, currentImg.x);
            const newY = Math.min(fixedY - 10, currentImg.y);
            this.cropRect.width = fixedX - newX;
            this.cropRect.height = fixedY - newY;
            this.cropRect.x = newX;
            this.cropRect.y = newY;
        } else if (this.dragMode === 'resize-tr') {
            fixedX = this.cropRect.x;
            fixedY = this.cropRect.y + this.cropRect.height;
            const newY = Math.min(fixedY - 10, currentImg.y);
            this.cropRect.width = Math.max(10, currentImg.x - fixedX);
            this.cropRect.height = fixedY - newY;
            this.cropRect.y = newY;
        } else if (this.dragMode === 'resize-bl') {
            fixedX = this.cropRect.x + this.cropRect.width;
            fixedY = this.cropRect.y;
            const newX = Math.min(fixedX - 10, currentImg.x);
            this.cropRect.width = fixedX - newX;
            this.cropRect.height = Math.max(10, currentImg.y - fixedY);
            this.cropRect.x = newX;
        }
        
        // Clamp logic for resize could be added here to prevent going out of image bounds
        // ...
        
        // We don't reset dragStart for resize because we calculate absolute positions from mouse
    }
    
    this.onCropChange(this.cropRect);
    this.render();
  }

  private handleMouseUp() {
    this.isDragging = false;
    this.dragMode = null;
    this.dragStart = null;
  }

  public render() {
    if (!this.ctx) return;
    
    // Clear
    this.ctx.fillStyle = '#111827'; // gray-900
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.image) {
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.font = '16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('No image loaded', this.canvas.width / 2, this.canvas.height / 2);
        return;
    }

    // Calculate draw coords
    const topLeft = this.imageToCanvas(0, 0);
    const bottomRight = this.imageToCanvas(this.image.width, this.image.height);
    const drawW = bottomRight.x - topLeft.x;
    const drawH = bottomRight.y - topLeft.y;

    // Draw Image
    this.ctx.drawImage(this.image, topLeft.x, topLeft.y, drawW, drawH);

    // Draw Overlay
    if (this.cropRect) {
        const cTL = this.imageToCanvas(this.cropRect.x, this.cropRect.y);
        const cBR = this.imageToCanvas(this.cropRect.x + this.cropRect.width, this.cropRect.y + this.cropRect.height);
        const cx = cTL.x;
        const cy = cTL.y;
        const cw = cBR.x - cTL.x;
        const ch = cBR.y - cTL.y;

        // Darken outside
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.rect(cx, cy, cw, ch);
        this.ctx.clip('evenodd');
        this.ctx.fill();
        
        this.ctx.resetTransform(); // Reset clip

        // Border
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx, cy, cw, ch);

        // Handles
        this.ctx.fillStyle = '#fff';
        const handleSize = 8;
        const half = handleSize / 2;
        
        this.ctx.fillRect(cx - half, cy - half, handleSize, handleSize); // TL
        this.ctx.fillRect(cx + cw - half, cy - half, handleSize, handleSize); // TR
        this.ctx.fillRect(cx - half, cy + ch - half, handleSize, handleSize); // BL
        this.ctx.fillRect(cx + cw - half, cy + ch - half, handleSize, handleSize); // BR
        
        // Grid
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(cx + cw / 3, cy);
        this.ctx.lineTo(cx + cw / 3, cy + ch);
        this.ctx.moveTo(cx + 2 * cw / 3, cy);
        this.ctx.lineTo(cx + 2 * cw / 3, cy + ch);
        this.ctx.moveTo(cx, cy + ch / 3);
        this.ctx.lineTo(cx + cw, cy + ch / 3);
        this.ctx.moveTo(cx, cy + 2 * ch / 3);
        this.ctx.lineTo(cx + cw, cy + 2 * ch / 3);
        this.ctx.stroke();
    }
  }
}
