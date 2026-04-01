import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as agPsd from 'ag-psd';
// @ts-ignore
import PSD from 'psd.js';
import { PsdFormat } from '../src/formats/psd-format';
import { loadPsdFile, convertPsdToLayers } from '../src/psd-handler';

import { createCanvas, ImageData as NodeImageData } from 'canvas';

// Set Canvas for the environment
(global as any).HTMLCanvasElement = class {};
(global as any).ImageData = NodeImageData;
(global as any).document = {
    createElement: (name: string) => {
        if (name === 'canvas') return createCanvas(1, 1);
        return {};
    }
} as any;

// Set globals for psd-handler.ts
const psdLib = (PSD as any).default || PSD;
import * as fs2 from 'fs';
fs2.appendFileSync('test.log', `[DEBUG] PSD lib type: ${typeof psdLib}\n`);
(global as any).agPsd = agPsd;
(global as any).PSD = psdLib;
(global as any).window.PSD = psdLib;

describe('PSD Layered Roundtrip Test', () => {
    const testDir = path.resolve(__dirname, '../io-format-tests');
    const sourcePsd = path.join(testDir, 'layered.psd');
    const targetPsd = path.join(testDir, 'layered_roundtrip.psd');

    it('should read layered.psd and rewrite it while preserving layers', async () => {
        if (!fs.existsSync(sourcePsd)) {
            console.warn(`Source PSD not found at ${sourcePsd}.`);
            return;
        }

        const nodeBuffer = fs.readFileSync(sourcePsd);
        
        console.log(`[TEST] Reading ${sourcePsd} using agPsd...`);
        // Use agPsd directly for reading in test since it's more reliable in Node/JSDOM than psd.js
        const psdData = agPsd.readPsd(nodeBuffer);
        
        console.log(`[TEST] Decoded ${psdData.children?.length} layers.`);
        expect(psdData.children?.length).toBeGreaterThan(1);

        // Construct DecodedImage for PsdFormat.write
        const decoded = {
            width: psdData.width,
            height: psdData.height,
            layers: psdData.children?.map(c => ({
                name: c.name,
                canvas: c.canvas, // ag-psd read produces canvases if skipLayerImages is false
                visible: !c.hidden,
                opacity: c.opacity ?? 1,
                blendMode: c.blendMode ?? 'normal',
                x: c.left || 0,
                y: c.top || 0
            }))
        };

        const psdFormat = new PsdFormat();
        console.log(`[TEST] Writing ${targetPsd}...`);
        const outBuffer = await psdFormat.write(decoded as any);
        
        fs.writeFileSync(targetPsd, Buffer.from(outBuffer));
        console.log(`[TEST] Written ${outBuffer.byteLength} bytes.`);

        expect(outBuffer.byteLength).toBeGreaterThan(0);
        
        // Re-read the output to verify layer count
        const reReadData = agPsd.readPsd(outBuffer);
        
        console.log(`[TEST] Verification: Exported file has ${reReadData.children?.length} layers.`);
        expect(reReadData.children?.length).toBe(decoded.layers?.length || 0);
    });
});
