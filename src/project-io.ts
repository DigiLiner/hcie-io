/**
 * @file project-io.ts
 * @description HCIE project file (.hcie) serialization and deserialization.
 * Migrated from project_io.js.
 */

import { g, layers, LayerClass, newDocument } from '@hcie/core';
import type { BlendMode, Shape, LayerType } from '@hcie/shared';
import { imageFormatRegistry } from './format-registry';
import { DecodedImage } from './format-interface';

interface SerializedLayer {
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  locked: boolean;
  type: LayerType;
  data: string; // base64 data URL
  shapes?: Shape[];
  textData?: import('@hcie/core').TextData;
}


interface SerializedProject {
  version: number;
  width: number;
  height: number;
  backgroundColor: string;
  layers: SerializedLayer[];
}

export class ProjectIO {
  static async saveProject(): Promise<string> {
    const project: SerializedProject = {
      version: 2, // Upgraded version for vector/text support
      width: g.image_width,
      height: g.image_height,
      backgroundColor: g.image_bg_color,
      layers: [],
    };

    for (const layer of layers) {
      let dataUrl: string;
      if (typeof (layer.canvas as HTMLCanvasElement).toDataURL === 'function') {
        dataUrl = (layer.canvas as HTMLCanvasElement).toDataURL('image/png');
      } else {
        // Fallback for OffscreenCanvas
        const tmp = document.createElement('canvas');
        tmp.width = layer.canvas.width;
        tmp.height = layer.canvas.height;
        const tmpCtx = tmp.getContext('2d');
        if (!tmpCtx) throw new Error('Could not get 2D context for temp canvas');
        tmpCtx.drawImage(layer.canvas as CanvasImageSource, 0, 0);
        dataUrl = tmp.toDataURL('image/png');
      }

      project.layers.push({
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        locked: layer.locked,
        type: layer.type,
        data: dataUrl,
        shapes: layer.shapes,
        textData: layer.textData,
      });
    }

    return JSON.stringify(project);
  }

  static async loadProject(jsonString: string): Promise<boolean> {
    try {
      const project = JSON.parse(jsonString) as SerializedProject;

      if (!project.width || !project.height || !project.layers) {
        throw new Error('Invalid project file format');
      }

      console.log(`Loading Project v${project.version || 1}...`);

      g.image_width = project.width;
      g.image_height = project.height;

      if (window.resizeCanvas) {
        window.resizeCanvas(g.image_width, g.image_height);
      }

      // Clear and rebuild layers
      layers.length = 0;

      for (const layerData of project.layers) {
        const newLayer = new LayerClass(layerData.name, g.image_width, g.image_height);
        newLayer.visible = layerData.visible;
        newLayer.opacity = layerData.opacity;
        newLayer.blendMode = layerData.blendMode ?? 'source-over';
        newLayer.locked = layerData.locked ?? false;
        newLayer.type = layerData.type ?? 'raster';
        newLayer.shapes = layerData.shapes;
        newLayer.textData = layerData.textData ?? {
            text: '', x: 0, y: 0,
            font: 'Roboto', size: 40, color: '#000000',
            bold: false, italic: false,
        };

        // Load the raster content
        if (layerData.data) {
            await new Promise<void>((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                (newLayer.ctx as CanvasRenderingContext2D).drawImage(img, 0, 0);
                resolve();
              };
              img.onerror = () => reject(new Error(`Failed to load layer image: ${layerData.name}`));
              img.src = layerData.data;
            });
        }

        layers.push(newLayer);
      }

      if (layers.length === 0) g.initDefaultLayer();

      g.activeLayerIndex = Math.max(0, layers.length - 1);

      window.historyManager?.clear();
      window.renderLayers?.();
      window.updateLayerPanel?.();
      
      // If we have vector layers, we might want to ensure they are synchronized with the raster engine if needed.
      // Usually, renderLayers handles the display of the canvas contents loaded from dataURL.

      console.log('Project loaded successfully');
      return true;
    } catch (err) {
      console.error('Failed to load project:', err);
      alert(`Error loading project file: ${(err as Error).message}`);
      return false;
    }
  }
  static async importImage(buffer: ArrayBuffer, fileName: string): Promise<boolean> {
    console.log(`[ProjectIO] Importing ${fileName}...`);
    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    
    // Check if it's a project file
    if (ext === ".hcie") {
        const decoder = new TextDecoder();
        const json = decoder.decode(buffer);
        return await this.loadProject(json);
    }

    const format = imageFormatRegistry.getByExtension(ext);
    if (!format || !format.canRead) {
        throw new Error(`Unsupported or unreadable format: ${ext}`);
    }

    const decodedImage = await format.read(buffer);
    if (!decodedImage || !decodedImage.layers || decodedImage.layers.length === 0) {
        throw new Error(`The format adapter for ${ext} returned no valid image data.`);
    }

    // Initialize document with image size from DecodedImage
    newDocument(fileName, decodedImage.width, decodedImage.height);

    // Add layers
    layers.length = 0;
    for (let i = 0; i < decodedImage.layers.length; i++) {
        const layerData = decodedImage.layers[i];
        const layerName = layerData.name || `Layer ${i + 1}`;
        const canvasOrData = layerData.canvas;
        
        let width = 0;
        let height = 0;
        if (canvasOrData instanceof ImageData) {
            width = canvasOrData.width;
            height = canvasOrData.height;
        } else {
            width = canvasOrData.width;
            height = canvasOrData.height;
        }

        const layer = new LayerClass(layerName, width, height);
        
        // Respect metadata from format adapters
        layer.visible = layerData.visible !== false;
        layer.opacity = layerData.opacity ?? 1.0;
        layer.blendMode = (layerData.blendMode as any) || 'source-over';
        (layer as any).x = layerData.x ?? 0;
        (layer as any).y = layerData.y ?? 0;

        if (canvasOrData instanceof ImageData) {
            (layer.ctx as CanvasRenderingContext2D).putImageData(canvasOrData, 0, 0);
        } else {
            (layer.ctx as CanvasRenderingContext2D).drawImage(canvasOrData, 0, 0);
        }
        layers.push(layer);
    }

    g.activeLayerIndex = layers.length - 1;
    
    // Sync with document state
    if (typeof (window as any).saveCurrentDocumentState === "function") {
        (window as any).saveCurrentDocumentState();
    }

    if (window.resizeCanvas) window.resizeCanvas(g.image_width, g.image_height);
    window.renderLayers?.();
    window.updateLayerPanel?.();
    
    console.log(`[ProjectIO] Successfully imported ${fileName}. Layers: ${layers.length}`);
    return true;
  }

  static async exportImage(formatExt: string): Promise<Uint8Array | string> {
    const format = imageFormatRegistry.getByExtension(formatExt);
    
    if (formatExt === ".hcie" || !format || !format.canWrite) {
        return await this.saveProject();
    }

    // For multi-layer formats, we might want to pass all layers.
    // For now, the interface takes one ImageData (flattened).
    const canvas = document.createElement("canvas");
    canvas.width = g.image_width;
    canvas.height = g.image_height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create flatten context");

    // Flatten all visible layers
    for (const layer of layers) {
        if (layer.visible) {
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = (layer.blendMode as any) || "source-over";
            // Use offsets if available (added dynamically by import logic or editor)
            ctx.drawImage(layer.canvas as HTMLCanvasElement, (layer as any).x || 0, (layer as any).y || 0);
        }
    }

    const flattenedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Construct the full DecodedImage for formats that support layers
    const decoded: DecodedImage = {
        width: g.image_width,
        height: g.image_height,
        composite: flattenedData,
        layers: layers.map(l => ({
            name: l.name,
            canvas: l.canvas,
            visible: l.visible,
            opacity: l.opacity,
            blendMode: l.blendMode,
            x: (l as any).x || 0,
            y: (l as any).y || 0
        }))
    };

    const buffer = await format.write(decoded);
    return new Uint8Array(buffer);
  }
}

// Browser global
declare global {
  interface Window {
    ProjectIO: typeof ProjectIO;
    resizeCanvas?: (w: number, h: number) => void;
  }
}
window.ProjectIO = ProjectIO;
