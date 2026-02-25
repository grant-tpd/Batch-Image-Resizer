import { ImageLoader } from './ImageLoader';
import { CropEngine } from './CropEngine';
import { BatchProcessor } from './BatchProcessor';
import { PresetManager } from './PresetManager';
import { AppState, SizePreset } from './types';

export class UIController {
  private appState: AppState = {
    originalImage: null,
    originalFile: null,
    cropRect: null,
    presets: [],
    isProcessing: false,
    outputFormat: 'jpg',
    jpgQuality: 0.9,
  };

  private imageLoader: ImageLoader;
  private cropEngine: CropEngine | null = null;
  private batchProcessor: BatchProcessor;
  private presetManager: PresetManager;

  private container: HTMLElement;
  private sidebarEl!: HTMLElement;
  private mainEl!: HTMLElement;
  private canvasEl!: HTMLCanvasElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.batchProcessor = new BatchProcessor();
    this.presetManager = new PresetManager(this.onPresetsChanged.bind(this));
    this.imageLoader = new ImageLoader(this.onImageLoaded.bind(this));
  }

  public init() {
    this.renderLayout();
    this.setupElements();
    this.renderPresetsList(); // Render initial presets
    
    this.imageLoader.setupDragAndDrop(
      document.getElementById('drop-zone')!,
      document.getElementById('file-input') as HTMLInputElement
    );

    window.addEventListener('resize', () => {
      if (this.appState.originalImage && this.cropEngine) {
        const container = document.getElementById('canvas-container')!;
        this.canvasEl.width = container.clientWidth;
        this.canvasEl.height = container.clientHeight;
        this.cropEngine.render();
      }
    });
  }

  private renderLayout() {
    this.container.innerHTML = `
      <div class="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
        <!-- Sidebar -->
        <aside class="w-80 bg-gray-800 border-r border-gray-700 flex flex-col shadow-xl z-10">
          <div class="p-6 border-b border-gray-700 bg-gray-800">
            <h1 class="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Batch Resizer</h1>
            <p class="text-xs text-gray-400 mt-1">High-performance crop tool</p>
          </div>
          
          <div id="presets-list" class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <!-- Presets injected here -->
          </div>

          <div class="p-4 border-t border-gray-700 bg-gray-800 space-y-4">
            <button id="add-preset-btn" class="w-full py-2 px-4 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-700/50 transition-all text-sm flex items-center justify-center gap-2 group">
              <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              Add New Size
            </button>

            <div class="space-y-3 pt-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-400">Format</span>
                <div class="flex bg-gray-900 rounded-lg p-1">
                  <button id="fmt-jpg" class="px-3 py-1 rounded-md text-xs font-medium transition-colors bg-indigo-600 text-white">JPG</button>
                  <button id="fmt-png" class="px-3 py-1 rounded-md text-xs font-medium transition-colors text-gray-400 hover:text-white">PNG</button>
                </div>
              </div>

              <div id="quality-control" class="space-y-1">
                <div class="flex justify-between text-xs text-gray-400">
                  <span>Quality</span>
                  <span id="quality-val">90%</span>
                </div>
                <input type="range" id="quality-slider" min="10" max="100" value="90" class="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500">
              </div>
            </div>

            <button id="download-btn" class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Download All
            </button>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 relative bg-gray-950 flex flex-col">
          <div id="drop-zone" class="absolute inset-4 border-2 border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:border-indigo-500 hover:bg-gray-900/50 transition-all cursor-pointer z-0">
            <div class="text-center space-y-4 pointer-events-none">
              <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </div>
              <h3 class="text-xl font-medium text-gray-300">Drop image here</h3>
              <p class="text-sm text-gray-500">or click to upload</p>
            </div>
            <input type="file" id="file-input" class="hidden" accept="image/*">
          </div>
          
          <div id="canvas-container" class="absolute inset-0 flex items-center justify-center p-8 hidden z-10 pointer-events-none">
             <canvas id="main-canvas" class="max-w-full max-h-full shadow-2xl rounded-lg pointer-events-auto cursor-crosshair"></canvas>
          </div>
          
          <!-- Floating Controls (Zoom/Reset) could go here -->
        </main>
      </div>
    `;
  }

  private setupElements() {
    this.sidebarEl = document.getElementById('presets-list')!;
    this.canvasEl = document.getElementById('main-canvas') as HTMLCanvasElement;
    
    // Add Preset
    document.getElementById('add-preset-btn')?.addEventListener('click', () => {
      this.presetManager.addPreset({
        id: Date.now().toString(),
        width: 1080,
        height: 1080,
        label: 'New Size',
        lockAspectRatio: true
      });
    });

    // Format Toggle
    const btnJpg = document.getElementById('fmt-jpg')!;
    const btnPng = document.getElementById('fmt-png')!;
    const qualityControl = document.getElementById('quality-control')!;
    
    btnJpg.addEventListener('click', () => {
      this.appState.outputFormat = 'jpg';
      btnJpg.classList.replace('text-gray-400', 'text-white');
      btnJpg.classList.replace('bg-gray-900', 'bg-indigo-600'); // Wait, logic error in class replacement
      // Reset classes
      btnJpg.className = "px-3 py-1 rounded-md text-xs font-medium transition-colors bg-indigo-600 text-white";
      btnPng.className = "px-3 py-1 rounded-md text-xs font-medium transition-colors text-gray-400 hover:text-white";
      qualityControl.classList.remove('opacity-50', 'pointer-events-none');
    });

    btnPng.addEventListener('click', () => {
      this.appState.outputFormat = 'png';
      btnPng.className = "px-3 py-1 rounded-md text-xs font-medium transition-colors bg-indigo-600 text-white";
      btnJpg.className = "px-3 py-1 rounded-md text-xs font-medium transition-colors text-gray-400 hover:text-white";
      qualityControl.classList.add('opacity-50', 'pointer-events-none');
    });

    // Quality Slider
    const slider = document.getElementById('quality-slider') as HTMLInputElement;
    const valDisplay = document.getElementById('quality-val')!;
    slider.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.appState.jpgQuality = val / 100;
      valDisplay.textContent = `${val}%`;
    });

    // Download
    document.getElementById('download-btn')?.addEventListener('click', () => {
      this.handleDownload();
    });
  }

  private onPresetsChanged(presets: SizePreset[]) {
    this.appState.presets = presets;
    this.renderPresetsList();
  }

  private renderPresetsList() {
    const list = document.getElementById('presets-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    this.appState.presets.forEach(preset => {
      const el = document.createElement('div');
      el.className = 'bg-gray-900/50 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors group';
      el.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <input type="text" value="${preset.label}" class="bg-transparent text-sm font-medium text-white focus:outline-none focus:border-b border-indigo-500 w-full mr-2" data-id="${preset.id}" data-field="label">
          <button class="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" data-action="delete" data-id="${preset.id}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="relative">
            <span class="absolute left-2 top-1.5 text-xs text-gray-500">W</span>
            <input type="number" value="${preset.width}" class="w-full bg-gray-800 rounded px-2 py-1 pl-6 text-xs text-gray-300 focus:ring-1 focus:ring-indigo-500 outline-none border border-gray-700" data-id="${preset.id}" data-field="width">
          </div>
          <div class="relative">
            <span class="absolute left-2 top-1.5 text-xs text-gray-500">H</span>
            <input type="number" value="${preset.height}" class="w-full bg-gray-800 rounded px-2 py-1 pl-6 text-xs text-gray-300 focus:ring-1 focus:ring-indigo-500 outline-none border border-gray-700" data-id="${preset.id}" data-field="height">
          </div>
        </div>
        <div class="mt-2 flex items-center">
            <input type="checkbox" id="lock-${preset.id}" ${preset.lockAspectRatio ? 'checked' : ''} class="w-3 h-3 rounded bg-gray-800 border-gray-600 text-indigo-600 focus:ring-indigo-500" data-id="${preset.id}" data-field="lockAspectRatio">
            <label for="lock-${preset.id}" class="ml-2 text-xs text-gray-500 select-none cursor-pointer">Lock Aspect Ratio</label>
        </div>
      `;
      
      // Bind events
      const inputs = el.querySelectorAll('input');
      inputs.forEach(input => {
        input.addEventListener('change', (e) => {
          const target = e.target as HTMLInputElement;
          const field = target.dataset.field as keyof SizePreset;
          
          if (field === 'lockAspectRatio') {
             this.presetManager.updatePreset(preset.id, { lockAspectRatio: target.checked }, true);
             this.appState.presets = this.presetManager.getPresets();
             return;
          }

          const val = field === 'label' ? target.value : parseInt(target.value);
          
          // Handle Aspect Ratio Lock
          let updates: Partial<SizePreset> = { [field]: val };
          
          if (preset.lockAspectRatio && (field === 'width' || field === 'height')) {
             const ratio = preset.width / preset.height;
             if (field === 'width') {
                updates.height = Math.round((val as number) / ratio);
                // Update the DOM input for height immediately
                const heightInput = el.querySelector(`input[data-field="height"]`) as HTMLInputElement;
                if (heightInput) heightInput.value = updates.height.toString();
             } else {
                updates.width = Math.round((val as number) * ratio);
                // Update the DOM input for width immediately
                const widthInput = el.querySelector(`input[data-field="width"]`) as HTMLInputElement;
                if (widthInput) widthInput.value = updates.width.toString();
             }
          }

          this.presetManager.updatePreset(preset.id, updates, true);
          // Update local state reference
          this.appState.presets = this.presetManager.getPresets();
        });
      });

      el.querySelector('button[data-action="delete"]')?.addEventListener('click', () => {
        this.presetManager.removePreset(preset.id);
      });

      list.appendChild(el);
    });
  }

  private onImageLoaded(img: HTMLImageElement, file: File) {
    this.appState.originalImage = img;
    this.appState.originalFile = file;

    // Show canvas, hide drop zone
    document.getElementById('drop-zone')?.classList.add('hidden');
    document.getElementById('canvas-container')?.classList.remove('hidden');

    // Init Crop Engine
    if (!this.cropEngine) {
      this.cropEngine = new CropEngine(this.canvasEl, (rect) => {
        this.appState.cropRect = rect;
      });
    }
    
    // Resize canvas to fit container while maintaining aspect ratio
    // Actually, canvas size should match image size for best quality?
    // No, canvas size should be display size.
    // Wait, CropEngine handles scaling.
    // Let's set canvas size to window size or container size.
    const container = document.getElementById('canvas-container')!;
    this.canvasEl.width = container.clientWidth;
    this.canvasEl.height = container.clientHeight;
    
    this.cropEngine.setImage(img);
  }

  private async handleDownload() {
    if (!this.appState.originalImage || !this.appState.cropRect) {
      alert('Please upload an image first.');
      return;
    }

    const btn = document.getElementById('download-btn') as HTMLButtonElement;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...`;

    try {
      // Use requestAnimationFrame to allow UI update before heavy processing
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to ensure render

      await this.batchProcessor.process(
        this.appState.originalImage,
        this.appState.cropRect,
        this.appState.presets,
        this.appState.outputFormat,
        this.appState.jpgQuality
      );
    } catch (e) {
      console.error(e);
      alert('Error processing images');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}
