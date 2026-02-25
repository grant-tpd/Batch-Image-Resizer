import { SizePreset } from './types';

export class PresetManager {
  private presets: SizePreset[] = [];
  private onChange: (presets: SizePreset[]) => void;

  constructor(onChange: (presets: SizePreset[]) => void) {
    this.onChange = onChange;
    this.loadPresets();
  }

  private loadPresets() {
    const stored = localStorage.getItem('image-resizer-presets');
    if (stored) {
      try {
        this.presets = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse presets', e);
        this.presets = this.getDefaultPresets();
      }
    } else {
      this.presets = this.getDefaultPresets();
    }
    this.onChange(this.presets);
  }

  private getDefaultPresets(): SizePreset[] {
    return [
      { id: '1', width: 1080, height: 1080, label: 'Instagram Square', lockAspectRatio: true },
      { id: '2', width: 1080, height: 1350, label: 'Instagram Portrait', lockAspectRatio: true },
      { id: '3', width: 1200, height: 630, label: 'Facebook/Twitter', lockAspectRatio: true },
      { id: '4', width: 1920, height: 1080, label: 'Full HD', lockAspectRatio: true },
    ];
  }

  public getPresets() {
    return this.presets;
  }

  public addPreset(preset: SizePreset) {
    this.presets.push(preset);
    this.savePresets();
  }

  public removePreset(id: string) {
    this.presets = this.presets.filter(p => p.id !== id);
    this.savePresets();
  }

  public updatePreset(id: string, updates: Partial<SizePreset>, silent = false) {
    this.presets = this.presets.map(p => p.id === id ? { ...p, ...updates } : p);
    this.savePresets(silent);
  }

  private savePresets(silent = false) {
    localStorage.setItem('image-resizer-presets', JSON.stringify(this.presets));
    if (!silent) {
      this.onChange(this.presets);
    }
  }
}
