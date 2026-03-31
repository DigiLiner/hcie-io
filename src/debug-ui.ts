/**
 * @file debug-ui.ts
 * @description Logic for the browser-based debugger for hcie-io.
 */

import { imageFormatRegistry } from './format-registry';

// Basic logging to the UI
function log(msg: string) {
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
        logOutput.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`;
        logOutput.scrollTop = logOutput.scrollHeight;
    }
    console.log(`[DEBUG-UI] ${msg}`);
}

const fileInput = document.getElementById('file-input') as HTMLInputElement;
const canvas = document.getElementById('canvas-preview') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

fileInput.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (status) status.textContent = `Processing ${file.name}...`;
    log(`Selected file: ${file.name} (${file.size} bytes)`);

    const ext = "." + file.name.split('.').pop()?.toLowerCase();
    const handler = imageFormatRegistry.getByExtension(ext);

    if (!handler) {
        log(`No registered handler found for extension ${ext}`);
        if (status) status.textContent = `Error: Unsupported format ${ext}`;
        return;
    }

    log(`Using handler: ${handler.name}`);

    try {
        const buffer = await file.arrayBuffer();
        log(`Decoding ${file.name}...`);
        
        // Pass to handler
        const doc = await handler.read(buffer);
        
        if (doc) {
            log(`Success! Decoded ${doc.layers.length} layers.`);
            log(`Dimensions: ${doc.width}x${doc.height}`);
            
            // Render to canvas
            canvas.width = doc.width;
            canvas.height = doc.height;
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Composite all layers onto preview canvas
                for (const layer of doc.layers) {
                    if (layer.visible) {
                        ctx.globalAlpha = layer.opacity;
                        ctx.globalCompositeOperation = (layer.blendMode || 'source-over') as GlobalCompositeOperation;
                        
                        if (layer.canvas instanceof ImageData) {
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = layer.canvas.width;
                            tempCanvas.height = layer.canvas.height;
                            tempCanvas.getContext('2d')?.putImageData(layer.canvas, 0, 0);
                            ctx.drawImage(tempCanvas, layer.x || 0, layer.y || 0);
                        } else {
                            ctx.drawImage(layer.canvas as HTMLCanvasElement, layer.x || 0, layer.y || 0);
                        }
                    }
                }
                status!.textContent = `Rendered ${file.name}`;
            }
        } else {
            log(`Handler returned null document.`);
            status!.textContent = `Failed to decode ${file.name}`;
        }
    } catch (err) {
        log(`Error: ${(err as Error).message}`);
        console.error(err);
        status!.textContent = `Error: See logs.`;
    }
};

// Automated Comparison Logic
const runCompBtn = document.getElementById('run-comparison') as HTMLButtonElement;
const runCompGimpBtn = document.getElementById('run-comparison-gimp') as HTMLButtonElement;
const compResults = document.getElementById('comparison-results') as HTMLDivElement;
const originalCanvas = document.getElementById('canvas-original') as HTMLCanvasElement;
const decodedCanvas = document.getElementById('canvas-decoded') as HTMLCanvasElement;
const pixelDiffLog = document.getElementById('pixel-diff-log');

async function runComparison(sourcePng: string, testFile: string, extension: string) {
    try {
        log(`Loading comparison files: ${sourcePng} and ${testFile}...`);
        compResults.style.display = 'block';

        const pngFile = await fetch(sourcePng).then(r => r.arrayBuffer());
        const targetFile = await fetch(testFile).then(r => r.arrayBuffer());

        log(`Original PNG size: ${pngFile.byteLength} bytes`);
        log(`Test Image (${extension}) size: ${targetFile.byteLength} bytes`);

        const pngHandler = imageFormatRegistry.getByExtension('.png');
        const targetHandler = imageFormatRegistry.getByExtension(extension);

        if (!pngHandler || !targetHandler) throw new Error(`Handlers not found for .png or ${extension}`);

        log("Decoding original PNG...");
        const pngDoc = await pngHandler.read(pngFile);
        log(`Decoding ${extension} image...`);
        const targetDoc = await targetHandler.read(targetFile);

        // Render both
        const renderTo = (canvas: HTMLCanvasElement, doc: any) => {
            canvas.width = doc.width;
            canvas.height = doc.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (const layer of doc.layers) {
                    if (layer.visible && layer.canvas) {
                        ctx.globalAlpha = layer.opacity || 1;
                        ctx.globalCompositeOperation = (layer.blendMode || 'source-over') as GlobalCompositeOperation;
                        
                        if (layer.canvas instanceof ImageData) {
                            const temp = document.createElement('canvas');
                            temp.width = layer.canvas.width;
                            temp.height = layer.canvas.height;
                            temp.getContext('2d')?.putImageData(layer.canvas, 0, 0);
                            ctx.drawImage(temp, layer.x || 0, layer.y || 0);
                        } else {
                            ctx.drawImage(layer.canvas, layer.x || 0, layer.y || 0);
                        }
                    }
                }
            }
        };

        renderTo(originalCanvas, pngDoc);
        renderTo(decodedCanvas, targetDoc);

        // Compare pixel stats
        const originalData = originalCanvas.getContext('2d')?.getImageData(0, 0, originalCanvas.width, originalCanvas.height).data;
        const decodedData = decodedCanvas.getContext('2d')?.getImageData(0, 0, decodedCanvas.width, decodedCanvas.height).data;

        if (originalData && decodedData) {
            let diffCount = 0;
            const len = Math.min(originalData.length, decodedData.length);
            for (let i = 0; i < len; i++) {
                if (Math.abs(originalData[i] - decodedData[i]) > 5) {
                    diffCount++;
                }
            }
            const diffPercent = (diffCount / len * 100).toFixed(2);
            pixelDiffLog!.textContent = `Pixel Difference: ${diffPercent}% (${diffCount} bytes significantly different).`;
            log(pixelDiffLog!.textContent);
        }

        log("Comparison complete.");
    } catch (err) {
        log(`Comparison Error: ${(err as Error).message}`);
        console.error(err);
    }
}

runCompBtn.onclick = () => runComparison('/color_test_original.png', '/krita-debug_test-image-saved-by-krita.kra', '.kra');
runCompGimpBtn.onclick = () => runComparison('/color_test_original.png', '/gimp-color_test_1.xcf', '.xcf');

// Quick Format Tests Logic
const testButtons = document.querySelectorAll('.test-btn');
testButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const ext = (e.target as HTMLButtonElement).getAttribute('data-ext');
        if (!ext) return;
        
        let filename = `/test${ext}`;
        if (ext === '.kra') filename = '/krita-debug_test-image-saved-by-krita.kra';
        if (ext === '.xcf') filename = '/gimp-color_test_1.xcf';
        if (ext === '.png') filename = '/color_test_original.png';

        if (status) status.textContent = `Testing ${ext}...`;
        log(`Quick testing ${ext} format using file ${filename}...`);
        
        try {
            const res = await fetch(filename);
            if (!res.ok) throw new Error(`File ${filename} not found (HTTP ${res.status}). Please put a test file in public folder.`);
            
            const buffer = await res.arrayBuffer();
            const handler = imageFormatRegistry.getByExtension(ext);
            if (!handler) throw new Error(`No handler for ${ext}`);
            
            log(`Decoding ${filename}...`);
            const doc = await handler.read(buffer);
            if (doc) {
                log(`Success! Decoded ${doc.layers.length} layers.`);
                log(`Dimensions: ${doc.width}x${doc.height}`);
                
                // Render to main canvas
                canvas.width = doc.width;
                canvas.height = doc.height;
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    for (const layer of doc.layers) {
                        if (layer.visible) {
                            ctx.globalAlpha = layer.opacity;
                            ctx.globalCompositeOperation = (layer.blendMode || 'source-over') as GlobalCompositeOperation;
                            
                            if (layer.canvas instanceof ImageData) {
                                const tempCanvas = document.createElement('canvas');
                                tempCanvas.width = layer.canvas.width;
                                tempCanvas.height = layer.canvas.height;
                                tempCanvas.getContext('2d')?.putImageData(layer.canvas, 0, 0);
                                ctx.drawImage(tempCanvas, layer.x || 0, layer.y || 0);
                            } else {
                                ctx.drawImage(layer.canvas as HTMLCanvasElement, layer.x || 0, layer.y || 0);
                            }
                        }
                    }
                    if (status) status.textContent = `Rendered Quick Test ${ext}`;
                }
            } else {
                 log(`Handler returned null.`);
                 if (status) status.textContent = `Failed quick test ${ext}`;
            }
        } catch(err) {
            log(`Error: ${(err as Error).message}`);
            if (status) status.textContent = `Error: See logs.`;
        }
    });
});

log('Debugger script loaded and ready.');
