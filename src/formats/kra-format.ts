/**
 * @file kra-format.ts
 * @description Krita (.kra) image format adapter.
 * Uses ZipLite for data extraction and DOMParser for metadata.
 * Supports both legacy PNG layers and modern Krita Tiled binary format.
 */

import { IImageFormat } from "../format-interface";
import { ZipLite } from "../zip-lite";
import { KritaTiles } from "./krita-tiles";

export class KraFormat implements IImageFormat {
  readonly name = "Krita";
  readonly extensions = [".kra"];
  readonly canRead = true;
  readonly canWrite = false;

  async read(buffer: ArrayBuffer): Promise<ImageData[]> {
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
        console.log(`[KraFormat] Using mergedimage.png fallback (${mergedData.byteLength} bytes)`);
        return [await this.bufferToImageData(mergedData)];
      }
      throw new Error("Invalid Krita file: No metadata or merged image found.");
    }

    // 2. Parse XML
    const xmlText = new TextDecoder().decode(maindocData);
    console.log(`[KraFormat] XML Content extracted (${xmlText.length} chars)`);
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        console.error(`[KraFormat] XML Parsing Error:`, parserError.textContent);
        const mergedData = await zip.extract("mergedimage.png");
        if (mergedData) return [await this.bufferToImageData(mergedData)];
        throw new Error("Krita metadata XML is corrupt and no fallback image found.");
    }

    // 2.1 Get Global Image Dimensions
    const imageNode = xmlDoc.getElementsByTagName("image")[0] || xmlDoc.getElementsByTagName("IMAGE")[0];
    const docWidth = parseInt(imageNode?.getAttribute("width") || "500", 10);
    const docHeight = parseInt(imageNode?.getAttribute("height") || "500", 10);
    console.log(`[KraFormat] Document dimensions: ${docWidth}x${docHeight}`);

    // 3. Layer Identification
    const layerNodes: Element[] = [];
    const allNodes = xmlDoc.getElementsByTagName("*");
    for (let i = 0; i < allNodes.length; i++) {
      const node = allNodes[i];
      if (node.hasAttribute('filename')) {
        layerNodes.push(node);
      }
    }

    console.log(`[KraFormat] Found ${layerNodes.length} layer nodes in XML.`);

    if (layerNodes.length === 0) {
      const mergedData = await zip.extract("mergedimage.png");
      if (mergedData) return [await this.bufferToImageData(mergedData)];
      return [];
    }

    // 4. Extract Layer Data
    const images: ImageData[] = [];
    for (let i = 0; i < layerNodes.length; i++) {
        const node = layerNodes[i];
        const filename = node.getAttribute("filename");
        if (!filename) continue;

        const layerName = node.getAttribute("name") || `Layer ${i + 1}`;
        const opacity = parseInt(node.getAttribute("opacity") || "255", 10);
        const visible = node.getAttribute("visible") !== "0";
        
        const lx = parseInt(node.getAttribute("x") || "0", 10);
        const ly = parseInt(node.getAttribute("y") || "0", 10);
        console.log(`[KraFormat] Identifying layer "${layerName}" at (${lx}, ${ly}) opacity ${opacity/255}`);

        // Krita path variations handled by searching zip filenames
        const filenames = zip.getFilenames();
        const layerPath = filenames.find(p => p === filename || p === `layers/${filename}` || p.endsWith(`/layers/${filename}`));

        if (layerPath) {
            try {
                const layerData = await zip.extract(layerPath);
                if (!layerData) continue;

                const imgData = await this.bufferToImageData(layerData, docWidth, docHeight);
                
                (imgData as any).layerName = layerName;
                (imgData as any).isVisible = visible;
                (imgData as any).opacity = opacity / 255; 
                
                images.push(imgData);
                console.log(`[KraFormat] Successfully parsed layer: ${layerName}`);
            } catch (err) {
                console.warn(`[KraFormat] Failed to parse layer ${layerName}:`, err);
            }
        } else {
            console.warn(`[KraFormat] ZIP entry missing for "${layerName}" (filename: ${filename})`);
        }
    }

    // 5. Final results or fallback
    if (images.length === 0) {
      console.warn("[KraFormat] No valid raster layers could be parsed individually. Falling back to 'mergedimage.png'...");
      const mergedData = await zip.extract("mergedimage.png");
      if (mergedData) {
        const imgData = await this.bufferToImageData(mergedData);
        (imgData as any).layerName = "Merged (Flattened)";
        return [imgData];
      }
      throw new Error("Krita file could not be parsed: No valid layers or merged image found.");
    }

    console.log(`[KraFormat] Import finished. Total layers: ${images.length}`);
    return images.reverse(); // Bottom-to-Top stack
  }

  private async bufferToImageData(buffer: Uint8Array, width?: number, height?: number): Promise<ImageData> {
    // Check for Krita Tiled format signature
    const isKritaTile = buffer[0] === 0x56 && buffer[1] === 0x45 && buffer[2] === 0x52 && buffer[3] === 0x53; // "VERS"
    
    if (isKritaTile && width && height) {
        console.log("[KraFormat] Detected Krita Tiled format, parsing binary data...");
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

