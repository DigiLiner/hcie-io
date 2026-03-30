/**
 * @file psd-handler.ts
 * @description PSD file read/write using psd.js (read) and ag-psd (write).
 * Migrated from psd_handler.js.
 */

import { g, layers, LayerClass } from '@hcie/core';
import type { BlendMode, ILayer } from '@hcie/core';

// ─── Third-party library type shims ──────────────────────
// psd.js and ag-psd are loaded via <script> tags in index.html

declare global {
  const PSD: {
    new(data: Uint8Array): PSDInstance;
  } | undefined;
  const psd: typeof PSD | undefined;
  const agPsd: {
    writePsd(data: AgPsdData): ArrayBuffer | Uint8Array;
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
  canvas: HTMLCanvasElement | OffscreenCanvas;
  opacity: number;
  visible: boolean;
  blendMode: string;
  left: number;
  top: number;
}

interface AgPsdData {
  width: number;
  height: number;
  channels: number;
  canvas: null;
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
      const msg = 'PSD parsing failed. The file may be corrupt or an unsupported format.';
      console.error(msg);
      alert(msg);
      return null;
    }
    console.log('PSD loaded via psd');
    return psdObj;
  } catch (err) {
    const msg = `Error reading PSD: ${(err as Error).message}`;
    console.error(msg);
    alert(msg);
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

export async function convertPsdToLayers(psdObj: PSDInstance): Promise<LayerClass[]> {
  if (!psdObj) return [];
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

export async function savePsdFile(layerList: ILayer[]): Promise<Uint8Array | null> {
  if (typeof agPsd === 'undefined') {
    alert('PSD saving library (ag-psd) is not loaded. Please ensure ag-psd.js is available.');
    return null;
  }
  try {
    const psdData: AgPsdData = {
      width: g.image_width,
      height: g.image_height,
      channels: 4,
      canvas: null,
      children: layerList.map(layer => ({
        name: layer.name,
        canvas: layer.canvas as HTMLCanvasElement,
        opacity: layer.opacity,
        visible: layer.visible,
        blendMode: REVERSE_BLEND_MAP[layer.blendMode] || 'normal',
        left: 0,
        top: 0,
      })),
    };
    const result = agPsd.writePsd(psdData);
    const bytes = result instanceof Uint8Array ? result : new Uint8Array(result);
    return bytes;
  } catch (err) {
    console.error('Error creating PSD file:', err);
    alert(`Failed to create PSD file: ${(err as Error).message}`);
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
