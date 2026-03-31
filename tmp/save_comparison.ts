import fs from 'fs';
import path from 'path';
import jszip from 'jszip';
import { KraFormat } from './src/formats/kra-format';
import { PngFormat } from './src/formats/png-format';

// Mock Canvas/ImageData for Node (since PngFormat needs it)
// We'll use a very simple mock for now or install canvas
const { createCanvas, ImageData } = require('canvas');

async function runComparison() {
    const originalPngPath = 'io-format-tests/color_test_original.png';
    const kritaFileArray = [
        'io-format-tests/krita-debug_test-image-saved-by-krita.kra'
    ];

    const outDir = 'io-format-tests/comparison_results';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    // 1. Copy original as 1_original.png
    fs.copyFileSync(originalPngPath, path.join(outDir, '1_original.png'));

    // 2. Decode Krita file and save as 1_decoded_krita.png
    for (let i = 0; i < kritaFileArray.length; i++) {
        const kraPath = kritaFileArray[i];
        console.log(`Processing ${kraPath}...`);
        
        const kraBuffer = fs.readFileSync(kraPath);
        const format = new KraFormat();
        const decoded = await format.read(kraBuffer);

        if (decoded && decoded.layers.length > 0) {
            // Flatten or just take the first paint layer
            const layer = decoded.layers.find(l => l.name !== 'Background' && l.data) || decoded.layers[0];
            const imgData = layer.data;

            const canvas = createCanvas(imgData.width, imgData.height);
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imgData, 0, 0);

            const outPath = path.join(outDir, `${i + 1}_decoded_krita.png`);
            const out = fs.createWriteStream(outPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            out.on('finish', () => console.log(`Saved ${outPath}`));
        }
    }
}

runComparison().catch(console.error);
