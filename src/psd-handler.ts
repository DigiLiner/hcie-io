/**
 * @file psd-handler.ts
 * @description PSD file read/write using psd.js (read) and ag-psd (write).
 * Migrated from psd_handler.js.
 */

import { g, layers, LayerClass } from '@hcie/core';
import type { BlendMode, ILayer } from '@hcie/core';
import { LayerData } from './format-interface';

// ─── Third-party library type shims ──────────────────────
// psd.js and ag-psd are loaded via <script> tags in index.html

declare global {
  const PSD: {
    new(data: Uint8Array): PSDInstance;
  } | undefined;
  const psd: typeof PSD | undefined;
  const agPsd: {
    readPsd(data: ArrayBuffer | Uint8Array, options?: any): AgPsdData;
    writePsd(data: AgPsdData, options?: any): ArrayBuffer | Uint8Array;
  } | undefined;

  interface Window {
    loadPsdFile: (buffer: ArrayBuffer) => Promise<PSDInstance | null>;
    convertPsdToLayers: (psdObj: PSDInstance) => Promise<LayerClass[]>;
    savePsdFile: (layers: LayerClass[]) => Promise<Uint8Array | null>;
    applyPsdToCanvas?: (psd: PSDInstance) => void;
  }
}

interface PSDNode {
  name?: string;
  width: number;
  height: number;
  left: number;
  top: number;
  visible(): boolean;
  isGroup(): boolean;
  children(): PSDNode[];
  toPng(): HTMLImageElement;
  layer?: {
    opacity?: number;
    blendMode?: { blendKey: string };
    image?: { pixelData: number[] };
  };
}

interface PSDInstance {
  parse(): boolean;
  tree(): { width: number; height: number; children(): PSDNode[] };
}

interface AgPsdLayer {
  name: string;
  canvas: HTMLCanvasElement | OffscreenCanvas | ImageData;
  opacity: number;
  hidden: boolean;
  blendMode: string;
  left: number;
  top: number;
}

interface AgPsdData {
  width: number;
  height: number;
  channels: number;
  canvas: HTMLCanvasElement | OffscreenCanvas | ImageData | null;
  children: AgPsdLayer[];
}

// ─── Load PSD ─────────────────────────────────────────────

export async function loadPsdFile(arrayBuffer: ArrayBuffer): Promise<PSDInstance | null> {
  const Lib = typeof PSD !== 'undefined' ? PSD : (typeof psd !== 'undefined' ? psd : null);
  if (!Lib) {
    const msg = 'PSD library (psd.js) not loaded. Please check your internet connection or console.';
    console.error(msg);
    alert(msg);
    return null;
  }
  try {
    const uint8 = new Uint8Array(arrayBuffer);
    const psdObj = new Lib(uint8);
    if (!psdObj.parse()) {
      console.warn('PSD.js failed to parse. Trying ag-psd...');
      throw new Error('PSD.js parse failure');
    }
    console.log('PSD loaded via psd');
    return psdObj;
  } catch (err) {
    if (typeof agPsd !== 'undefined') {
        try {
            console.log('[PSD] Attempting read with ag-psd...');
            const data = agPsd.readPsd(arrayBuffer);
            // Wrap ag-psd data into a compatible structure or handle it specially
            return { __isAgPsd: true, data } as any;
        } catch (e) {
            console.error('ag-psd also failed to read:', e);
        }
    }
    const msg = `Error reading PSD: ${(err as Error).message}`;
    console.error(msg, err);
    if (typeof alert !== 'undefined') alert(msg);
    return null;
  }
}

// ─── Convert PSD to Layers ────────────────────────────────

const PSD_BLEND_MAP: Record<string, BlendMode> = {
  'norm': 'source-over', 'mul ': 'multiply', 'scrn': 'screen',
  'over': 'overlay', 'dark': 'darken', 'lite': 'lighten',
  'diff': 'difference', 'color': 'color', 'lum ': 'luminosity',
  'hue ': 'hue', 'sat ': 'saturation',
};

function getCleanName(node: PSDNode): string {
  // Priority: 1. Unicode Name (luni), 2. Layer Name (nam ), 3. Node Name
  const layer = (node as any).layer;
  let rawName = node.name || layer?.name || 'Layer';

  // Check additionalData for Unicode name if psd.js provides it
  if (layer?.additionalData?.luni) {
    rawName = layer.additionalData.luni;
  } else if (layer?.additionalData?.['nam ']) {
    rawName = layer.additionalData['nam '];
  }

  if (!rawName) return 'Layer';

  // Sanitize: psd.js sometimes includes binary garbage like 8BIM signatures or blend mode keys
  // if it miscalculates the Pascal string length.
  let clean = String(rawName)
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Strip control characters
    .replace(/8BIM.*/g, '')              // Strip 8BIM and everything after (metadata header)
    .replace(/unim.*/g, '')              // Strip unim (unicode indicator)
    .trim();

  // If we stripped too much or it's empty, fallback
  if (!clean || clean.length < 1) {
      // Try to extract the first part if it looks like binary mess
      const match = String(rawName).match(/^[a-zA-Z0-0\s_\-]+/);
      clean = match ? match[0].trim() : 'Layer';
  }

  return clean || 'Layer';
}

async function processNode(node: PSDNode, width: number, height: number): Promise<LayerClass[]> {
  if (node.isGroup()) {
    const groupChildren = node.children();
    const results = await Promise.all(
      [...groupChildren].reverse().map(child => processNode(child, width, height))
    );
    return results.flat();
  }

  const name = getCleanName(node);
  
  const layer = new LayerClass(name, width, height);
  layer.visible = node.visible();

  if (node.layer?.opacity != null) {
    layer.opacity = node.layer.opacity / 255;
  }
  const blendKey = node.layer?.blendMode?.blendKey;
  if (blendKey && PSD_BLEND_MAP[blendKey]) {
    layer.blendMode = PSD_BLEND_MAP[blendKey];
  }

  try {
    const img = node.toPng();
    if (img instanceof HTMLImageElement) {
      await new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) { resolve(); return; }
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
      (layer.ctx as CanvasRenderingContext2D).drawImage(img, node.left, node.top);
    } else if (node.layer?.image?.pixelData) {
      const { width: lw, height: lh, left, top } = node;
      if (lw > 0 && lh > 0) {
        const imageData = new ImageData(new Uint8ClampedArray(node.layer.image.pixelData), lw, lh);
        (layer.ctx as CanvasRenderingContext2D).putImageData(imageData, left, top);
      }
    }
  } catch (err) {
    console.error('Error drawing layer image:', err);
  }

  return [layer];
}

export async function convertPsdToLayers(psdObj: any): Promise<LayerClass[]> {
  if (!psdObj) return [];

  // Handle ag-psd fallback
  if (psdObj.__isAgPsd && psdObj.data) {
    const data: AgPsdData = psdObj.data;
    g.image_width = data.width || 0;
    g.image_height = data.height || 0;

    const layers: LayerClass[] = [];
    if (data.children) {
        // ag-psd children are already in top-to-bottom order usually, 
        // but HCIE expects bottom-to-top for internal layer list? 
        // Let's check existing logic: [ ...children].reverse().
        // So we reverse them here too.
        for (const child of [...data.children].reverse()) {
            if (child.canvas) {
                const layer = new LayerClass(child.name || 'Layer', g.image_width, g.image_height);
                layer.visible = !child.hidden;
                layer.opacity = child.opacity != null ? child.opacity : 1;
                // Simple blend mode mapping for ag-psd -> hcie
                layer.blendMode = 'source-over'; 
                
                const ctx = (layer.ctx as CanvasRenderingContext2D);
                ctx.drawImage(child.canvas as any, child.left || 0, child.top || 0);
                layers.push(layer);
            }
        }
    }
    return layers;
  }

  // Original PSD.js logic
  const tree = psdObj.tree();
  g.image_width = tree.width;
  g.image_height = tree.height;

  const children = tree.children();
  const results = await Promise.all(
    [...children].reverse().map(node => processNode(node, tree.width, tree.height))
  );
  return results.flat();
}

// ─── Save PSD ─────────────────────────────────────────────

// PSD blend modes for writing
const REVERSE_BLEND_MAP: Record<string, string> = {
  'source-over': 'normal',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
  'darken': 'darken',
  'lighten': 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  'difference': 'difference',
  'exclusion': 'exclusion',
  'hue': 'hue',
  'saturation': 'saturation',
  'color': 'color',
  'luminosity': 'luminosity',
};

/**
 * Ensures the given canvas-like object is an HTMLCanvasElement.
 * Converts OffscreenCanvas or ImageData if necessary.
 */
function ensureHTMLCanvas(canvas: any): HTMLCanvasElement | null {
  if (!canvas) return null;
  if (canvas instanceof HTMLCanvasElement) return canvas;
  
  if (typeof HTMLCanvasElement === 'undefined') {
    // We are likely in a Node/test environment without global Canvas.
    // If it's something with width/height, we hope ag-psd can handle it or we mock it.
    return canvas; 
  }

  const result = document.createElement('canvas');
  result.width = canvas.width;
  result.height = canvas.height;
  const ctx = result.getContext('2d');
  if (ctx) {
      if (canvas instanceof ImageData) {
          ctx.putImageData(canvas, 0, 0);
      } else {
        // Works for OffscreenCanvas or other CanvasImageSource
        ctx.drawImage(canvas, 0, 0);
      }
  }
  return result;
}

export async function savePsdFile(layerList: (ILayer | LayerData)[], composite?: ImageData): Promise<Uint8Array | null> {
  if (typeof agPsd === 'undefined') {
    const msg = 'PSD saving library (ag-psd) is not loaded. Please ensure ag-psd.js is available.';
    console.error(msg);
    if (typeof alert !== 'undefined') alert(msg);
    return null;
  }
  try {
    // If we have a composite ImageData, convert it to a canvas for ag-psd metadata
    let mainCanvas: any = null;
    if (composite) {
        mainCanvas = ensureHTMLCanvas(composite);
    }

    console.log(`[PSD] Encoding ${layerList.length} layers. Composite available: ${!!mainCanvas}`);

    const psdData: AgPsdData = {
      width: g.image_width,
      height: g.image_height,
      channels: 4,
      canvas: mainCanvas,
      children: layerList.map(layer => {
          const layerCanvas = ensureHTMLCanvas(layer.canvas);
          return {
            name: layer.name,
            canvas: layerCanvas as any,
            opacity: layer.opacity,
            hidden: !(layer as any).visible,
            blendMode: REVERSE_BLEND_MAP[layer.blendMode] || 'normal',
            left: (layer as any).x || 0,
            top: (layer as any).y || 0,
          };
      }),
    };
    
    // Some versions of ag-psd might need specific options for layered output
    const options = {
        generateThumbnail: true,
        invalidateThumbnails: true,
    };

    const result = agPsd.writePsd(psdData, options);
    return result instanceof ArrayBuffer ? new Uint8Array(result) : result;
  } catch (err) {
    console.error('Error saving PSD:', err);
    return null;
  }
}


// ─── Browser globals ──────────────────────────────────────

window.loadPsdFile = loadPsdFile;
window.convertPsdToLayers = convertPsdToLayers;
window.savePsdFile = async (ls) => savePsdFile(ls);

// Apply PSD layers to canvas — called from ui/menu-handlers.ts
window.applyPsdToCanvas = async (psdObj: PSDInstance) => {
  try {
    console.log('[PSD] Applying layers to canvas...');
    const newLayers = await convertPsdToLayers(psdObj);
    if (!newLayers || newLayers.length === 0) {
      alert('No layers found in PSD or conversion failed.');
      return;
    }
    
    layers.length = 0;
    newLayers.forEach(l => layers.push(l));
    if (layers.length === 0) g.initDefaultLayer();
    g.activeLayerIndex = Math.max(0, layers.length - 1);
    
    window.resizeCanvas?.(g.image_width, g.image_height);
    window.historyManager?.clear();
    window.renderLayers?.();
    window.updateLayerPanel?.();
    console.log('[PSD] Application complete.');
  } catch (err) {
    console.error('Error applying PSD to canvas:', err);
    alert(`Failed to apply PSD: ${(err as Error).message}`);
  }
};
