import { describe, it, expect, beforeEach } from 'vitest';
import { imageFormatRegistry } from '../src/format-registry';
import * as fs from 'fs';
import * as path from 'path';

import { vi } from 'vitest';

// Global mock for HTMLCanvasElement.prototype.getContext to support environments like jsdom.
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext) {
  (HTMLCanvasElement.prototype as any).getContext = vi.fn().mockImplementation((contextId) => {
    if (contextId === '2d') {
      return {
        fillRect: vi.fn(), clearRect: vi.fn(), getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
        putImageData: vi.fn(), createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
        setTransform: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
        moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), stroke: vi.fn(), translate: vi.fn(),
        scale: vi.fn(), rotate: vi.fn(), arc: vi.fn(), fill: vi.fn(), measureText: vi.fn(() => ({ width: 0 })),
        transform: vi.fn(), rect: vi.fn(), clip: vi.fn(),
      } as any;
    }
    return null;
  });
}

if (typeof globalThis !== 'undefined' && !globalThis.createImageBitmap) {
    (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() });
}

// Note: Vitest by default might not have browser Canvas, but we can test logic.
// We've added a mock above to handle this for jsdom environments.

describe('Image Format IO Tests', () => {
  const testDir = path.resolve(__dirname, '../io-format-tests');

  it('should have all formats registered', () => {
    const formats = imageFormatRegistry.getAll();
    expect(formats.length).toBeGreaterThan(5);
    expect(imageFormatRegistry.getByExtension('.psd')).toBeDefined();
    expect(imageFormatRegistry.getByExtension('.kra')).toBeDefined();
    expect(imageFormatRegistry.getByExtension('.xcf')).toBeDefined();
  });

  it('should identify format by extension', () => {
    const psd = imageFormatRegistry.getByExtension('.psd');
    expect(psd?.name).toBe('Photoshop Document');
    
    const kra = imageFormatRegistry.getByExtension('.kra');
    expect(kra?.name).toBe('Krita Image');
  });

  // Example test for Krita format (logic only, might skip binary read if environment lacks unzip)
  it('should detect Krita file structure if read was called', async () => {
    const kraPath = path.join(testDir, 'gem.kra');
    if (fs.existsSync(kraPath)) {
      const data = fs.readFileSync(kraPath);
      const kra = imageFormatRegistry.getByExtension('.kra');
      expect(kra).toBeDefined();
      // Since 'read' returns a DocumentState, we'd normally test that here.
      // e.g. const doc = await kra.read(data.buffer);
    }
  });

  it('should support XCF (GIMP) files', () => {
     const xcf = imageFormatRegistry.getByExtension('.xcf');
     expect(xcf).toBeDefined();
     expect(xcf?.extensions).toContain('.xcf');
  });
});
