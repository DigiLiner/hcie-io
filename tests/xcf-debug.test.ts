import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { XcfFormat } from '../src/formats/xcf-format';

// Mock canvas for JSDOM environment
if (typeof HTMLCanvasElement !== 'undefined') {
    (HTMLCanvasElement.prototype as any).getContext = vi.fn().mockImplementation((id) => {
        if (id === '2d') {
            return {
                clearRect: vi.fn(),
                putImageData: vi.fn(),
                drawImage: vi.fn(),
                createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(64 * 64 * 4) }),
                getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(64 * 64 * 4), width: 64, height: 64 }),
            };
        }
        return null;
    });
}

describe('XCF Format Debugger Mock Test', () => {
    const testDir = path.resolve(__dirname, '../io-format-tests');
    const xcfFile = path.join(testDir, 'gimp-color_test_1.xcf');

    it('should read XCF file without throwing errors', async () => {
        const nodeBuffer = fs.readFileSync(xcfFile);
        const buffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
        const xcf = new XcfFormat();
        
        console.log(`Reading XCF: ${xcfFile} (${buffer.byteLength} bytes)`);
        
        try {
            const doc = await xcf.read(buffer);
            console.log(`Decoded successfully: ${doc.width}x${doc.height}, layers: ${doc.layers.length}`);
            
            doc.layers.forEach((layer, i) => {
                console.log(`Layer ${i}: ${layer.name}, visible: ${layer.visible}, opacity: ${layer.opacity}`);
            });
            
            expect(doc.width).toBeGreaterThan(0);
            expect(doc.layers.length).toBeGreaterThan(0);
        } catch (err) {
            console.error('XCF READ ERROR:', err);
            throw err;
        }
    });
});
