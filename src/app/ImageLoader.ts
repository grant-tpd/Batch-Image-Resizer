import { AppState } from './types';

export class ImageLoader {
  private onImageLoaded: (img: HTMLImageElement, file: File) => void;

  constructor(onImageLoaded: (img: HTMLImageElement, file: File) => void) {
    this.onImageLoaded = onImageLoaded;
  }

  public handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.onImageLoaded(img, file);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  public setupDragAndDrop(dropZone: HTMLElement, fileInput: HTMLInputElement) {
    // Drag over
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
    });

    // Drag leave
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
    });

    // Drop
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFile(files[0]);
      }
    });

    // Click to upload
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.handleFile(files[0]);
      }
    });
  }
}
