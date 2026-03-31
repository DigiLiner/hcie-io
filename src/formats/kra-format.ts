/**
 * @file kra-format.ts
 * @description Krita (.kra) image format adapter.
 * Uses ZipLite for data extraction and DOMParser for metadata.
 * Supports both legacy PNG layers and modern Krita Tiled binary format.
 */

import { IImageFormat, DecodedImage } from "../format-interface";
import { ZipLite } from "../zip-lite";
import { KritaTiles } from "./krita-tiles";

export class KraFormat implements IImageFormat {
  readonly name = "Krita Image";
  readonly extensions = [".kra"];
  readonly canRead = true;
  readonly canWrite = false;

  async read(buffer: ArrayBuffer): Promise<DecodedImage> {
    console.log(`[KraFormat] Starting read. Buffer size: ${buffer.byteLength}`);
    
    let zip: ZipLite;
    try {
      zip = new ZipLite(buffer);
      const files = zip.getFilenames();
      console.log(`[KraFormat] ZIP loaded. Files found (${files.length}):`, files.slice(0, 10), files.length > 10 ? "..." : "");
    } catch (e: any) {
      console.error(`[KraFormat] ZipLite failed to load buffer:`, e);
      throw new Error(`Failed to parse Krita ZIP structure: ${e.message}`);
    }
    
    // 1. Metadata check
    const maindocData = await zip.extract("maindoc.xml") || await zip.extract("layers.xml");
    
    // If maindoc is missing, try fallback immediately
    if (!maindocData) {
      console.warn("[KraFormat] maindoc.xml not found, attempting mergedimage.png fallback...");
      const mergedData = await zip.extract("mergedimage.png");
      if (mergedData) {
        const imgData = await this.bufferToImageData(mergedData);
        return {
          width: imgData.width,
          height: imgData.height,
          layers: [{
            name: "Merged (Flattened)",
            canvas: imgData,
            visible: true,
            opacity: 1,
            blendMode: 'source-over',
            x: 0, y: 0
          }]
        };
      }
      throw new Error("Invalid Krita file: No metadata or merged image found.");
    }

    // 2. Parse XML
    const xmlText = new TextDecoder().decode(maindocData);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");

    // 2.1 Get Global Image Dimensions
    const imageNode = xmlDoc.getElementsByTagName("image")[0] || xmlDoc.getElementsByTagName("IMAGE")[0];
    const docWidth = parseInt(imageNode?.getAttribute("width") || "500", 10);
    const docHeight = parseInt(imageNode?.getAttribute("height") || "500", 10);

    // 3. Layer Identification
    const layerNodes: Element[] = [];
    const allNodes = xmlDoc.getElementsByTagName("*");
    for (let i = 0; i < allNodes.length; i++) {
        const node = allNodes[i];
        if (node.hasAttribute('filename')) {
            layerNodes.push(node);
        }
    }

    // 4. Extract Layer Data
    const layers: any[] = [];
    for (let i = 0; i < layerNodes.length; i++) {
        const node = layerNodes[i];
        const filename = node.getAttribute("filename");
        if (!filename) continue;

        const layerName = node.getAttribute("name") || `Layer ${i + 1}`;
        const opacity = parseInt(node.getAttribute("opacity") || "255", 10);
        const visible = node.getAttribute("visible") !== "0";
        const lx = parseInt(node.getAttribute("x") || "0", 10);
        const ly = parseInt(node.getAttribute("y") || "0", 10);

        const layerPath = zip.getFilenames().find(p => p === filename || p === `layers/${filename}` || p.endsWith(`/layers/${filename}`));

        if (layerPath) {
            try {
                const layerData = await zip.extract(layerPath);
                if (!layerData) continue;

                const isKritaTile = layerData[0] === 0x56 && layerData[1] === 0x45 && layerData[2] === 0x52 && layerData[3] === 0x53; // "VERS"
                const imgData = await this.bufferToImageData(layerData, docWidth, docHeight);
                
                layers.push({
                    name: layerName,
                    canvas: imgData,
                    visible,
                    opacity: opacity / 255,
                    blendMode: 'source-over',
                    // Tiles are absolute, legacy PNGs are relative.
                    x: isKritaTile ? 0 : lx,
                    y: isKritaTile ? 0 : ly
                });
            } catch (err) {
                console.warn(`[KraFormat] Failed to parse layer ${layerName}:`, err);
            }
        }
    }

    return {
        width: docWidth,
        height: docHeight,
        layers: layers.reverse() // Krita XML order is bottom-up
    };
  }


  private async bufferToImageData(buffer: Uint8Array, width?: number, height?: number): Promise<ImageData> {
    // Check for Krita Tiled format signature: "VERS"
    const isKritaTile = buffer[0] === 0x56 && buffer[1] === 0x45 && buffer[2] === 0x52 && buffer[3] === 0x53;
    
    if (isKritaTile && width && height) {
        // Krita tiles use absolute coordinates relative to (0,0).
        // Since we produce a doc-sized ImageData, we don't apply lx/ly offset separately in the layer.
        return KritaTiles.parse(buffer, width, height);
    }

    // Fallback/Default: Standard image format (PNG/JPG)
    const blob = new Blob([buffer] as any, { type: "image/png" });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create 2D context");
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  async write(_imageData: ImageData): Promise<ArrayBuffer> {
    throw new Error("Krita writing not implemented.");
  }
}

