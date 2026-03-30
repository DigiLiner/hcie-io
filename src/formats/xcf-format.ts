/**
 * @file xcf-format.ts
 * @description GIMP (.xcf) image format adapter.
 * Custom binary parser for standard raster layers (XCF v0-v14).
 */

import { IImageFormat } from "../format-interface";

export class XcfFormat implements IImageFormat {
  readonly name = "GIMP";
  readonly extensions = [".xcf"];
  readonly canRead = true;
  readonly canWrite = false;

  async read(buffer: ArrayBuffer): Promise<ImageData[]> {
    const view = new DataView(buffer);
    const magic = new TextDecoder().decode(buffer.slice(0, 9));
    if (magic !== "gimp xcf ") {
      throw new Error("Not a valid GIMP XCF file.");
    }

    const versionStr = new TextDecoder().decode(buffer.slice(9, 13));
    const version = parseInt(versionStr.substring(1), 10);
    const is64Bit = version >= 11;
    const offsetSize = is64Bit ? 8 : 4;

    const getPtr = (pos: number) => is64Bit ? Number(view.getBigUint64(pos)) : view.getUint32(pos);

    // Header properties
    const width = view.getUint32(14);
    const height = view.getUint32(18);
    const baseType = view.getUint32(22); // 0: RGB, 1: Grayscale, 2: Indexed

    // Skip image properties to get to the layer list
    let current = 26;
    while (current < buffer.byteLength) {
      const propType = view.getUint32(current);
      const propLen = view.getUint32(current + 4);
      if (propType === 0) { // PROP_END
        current += 8;
        break;
      }
      current += 8 + propLen;
    }

    // Layer selection (Pointers to layers)
    const layerPointers: number[] = [];
    while (current < buffer.byteLength) {
      const ptr = getPtr(current);
      if (ptr === 0) {
        current += offsetSize;
        break;
      }
      layerPointers.push(ptr);
      current += offsetSize;
    }

    const layers: ImageData[] = [];
    // GIMP stores layers top-to-bottom in the pointer list, but canvas stack is bottom-to-top.
    // We'll reverse them later or handle as needed. Let's keep them in order for now.
    for (const ptr of layerPointers) {
      try {
        const layer = await this.parseLayer(view, buffer, ptr, is64Bit);
        if (layer) layers.push(layer);
      } catch (e) {
        console.warn("Failed to parse GIMP layer at offset", ptr, e);
      }
    }

    return layers.reverse(); // Standard reverse for HCIE layer stack
  }

  private async parseLayer(view: DataView, buffer: ArrayBuffer, offset: number, is64Bit: boolean): Promise<ImageData | null> {
    const offsetSize = is64Bit ? 8 : 4;
    const getPtr = (pos: number) => is64Bit ? Number(view.getBigUint64(pos)) : view.getUint32(pos);

    const width = view.getUint32(offset);
    const height = view.getUint32(offset + 4);
    const type = view.getUint32(offset + 8); // 0: RGBA, 1: RGB, etc.
    const nameLen = view.getUint32(offset + 12);
    const name = new TextDecoder().decode(buffer.slice(offset + 16, offset + 16 + nameLen - 1));
    
    let current = offset + 16 + nameLen;
    let opacity = 255;
    let visible = true;
    let mode = 0;

    // Parse layer properties
    while (current < buffer.byteLength) {
      const propType = view.getUint32(current);
      const propLen = view.getUint32(current + 4);
      if (propType === 0) { // PROP_END
        current += 8;
        break;
      }
      
      if (propType === 6) opacity = view.getUint32(current + 8); // PROP_OPACITY
      if (propType === 7) visible = view.getUint32(current + 8) !== 0; // PROP_VISIBLE
      if (propType === 8) mode = view.getUint32(current + 8); // PROP_MODE
      
      current += 8 + propLen;
    }

    const hierarchyPtr = getPtr(current);
    const bpp = view.getUint32(hierarchyPtr + 8);
    const levelPtr = getPtr(hierarchyPtr + 12); // Level 0
    
    const lWidth = view.getUint32(levelPtr);
    const lHeight = view.getUint32(levelPtr + 4);
    
    const tilesWide = Math.ceil(width / 64);
    const tilesHigh = Math.ceil(height / 64);
    const tilePtrBase = levelPtr + 8;
    
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    for (let ty = 0; ty < tilesHigh; ty++) {
      for (let tx = 0; tx < tilesWide; tx++) {
        const tileIdx = ty * tilesWide + tx;
        const tilePtrPtr = tilePtrBase + tileIdx * offsetSize;
        const tilePtr = getPtr(tilePtrPtr);
        if (tilePtr === 0) continue;
        
        // Find approximate tile data length (until next tile or end of level)
        const nextPtr = (tileIdx + 1 < tilesWide * tilesHigh) ? getPtr(tilePtrPtr + offsetSize) : 0;
        let tileDataLen = (nextPtr > tilePtr) ? (nextPtr - tilePtr) : (64 * 64 * bpp * 2);
        
        const rawData = new Uint8Array(buffer, tilePtr, Math.min(tileDataLen, buffer.byteLength - tilePtr));
        const tilePixels = this.decodeTiledPlanar(rawData, bpp, 64, 64);
        
        const rw = Math.min(64, width - tx * 64);
        const rh = Math.min(64, height - ty * 64);
        const tileImgData = ctx.createImageData(rw, rh);
        
        // Reconstruct RGBA from decoded channels
        for (let py = 0; py < rh; py++) {
          for (let px = 0; px < rw; px++) {
            const srcIdx = (py * 64 + px);
            const dstIdx = (py * rw + px) * 4;
            
            if (bpp === 4) { // RGBA
              tileImgData.data[dstIdx] = tilePixels[0][srcIdx];
              tileImgData.data[dstIdx + 1] = tilePixels[1][srcIdx];
              tileImgData.data[dstIdx + 2] = tilePixels[2][srcIdx];
              tileImgData.data[dstIdx + 3] = tilePixels[3][srcIdx];
            } else if (bpp === 3) { // RGB
              tileImgData.data[dstIdx] = tilePixels[0][srcIdx];
              tileImgData.data[dstIdx + 1] = tilePixels[1][srcIdx];
              tileImgData.data[dstIdx + 2] = tilePixels[2][srcIdx];
              tileImgData.data[dstIdx + 3] = 255;
            } else if (bpp === 1) { // Gray
              const v = tilePixels[0][srcIdx];
              tileImgData.data[dstIdx] = v;
              tileImgData.data[dstIdx + 1] = v;
              tileImgData.data[dstIdx + 2] = v;
              tileImgData.data[dstIdx + 3] = 255;
            } else if (bpp === 2) { // GrayA
              const v = tilePixels[0][srcIdx];
              tileImgData.data[dstIdx] = v;
              tileImgData.data[dstIdx + 1] = v;
              tileImgData.data[dstIdx + 2] = v;
              tileImgData.data[dstIdx + 3] = tilePixels[1][srcIdx];
            }
          }
        }
        ctx.putImageData(tileImgData, tx * 64, ty * 64);
      }
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    (imgData as any).layerName = name;
    (imgData as any).isVisible = visible;
    (imgData as any).opacity = opacity;
    (imgData as any).blendMode = this.mapXcfBlendMode(mode);
    
    return imgData;
  }

  private decodeTiledPlanar(data: Uint8Array, bpp: number, tw: number, th: number): Uint8Array[] {
    const channels: Uint8Array[] = [];
    let inPos = 0;
    const expectedChannelSize = tw * th;

    for (let c = 0; c < bpp; c++) {
      const out = new Uint8Array(expectedChannelSize);
      let outPos = 0;
      while (outPos < expectedChannelSize && inPos < data.length) {
        const n = new Int8Array([data[inPos++]])[0];
        if (n >= 0 && n <= 126) {
          const count = n + 1;
          for (let i = 0; i < count && outPos < expectedChannelSize; i++) {
            out[outPos++] = data[inPos++];
          }
        } else if (n === -128) {
          // NOP in some RLE variants, but GIMP might use it. Skip for safety.
          continue; 
        } else {
          const count = -n + 1;
          const val = data[inPos++];
          for (let i = 0; i < count && outPos < expectedChannelSize; i++) {
            out[outPos++] = val;
          }
        }
      }
      channels.push(out);
    }
    return channels;
  }

  private mapXcfBlendMode(mode: number): string {
    const modes: Record<number, string> = {
      0: "normal",
      1: "dissolve",
      2: "behind",
      3: "multiply",
      4: "screen",
      5: "overlay",
      6: "difference",
      7: "addition",
      8: "subtract",
      9: "darken-only",
      10: "lighten-only",
      11: "hue",
      12: "saturation",
      13: "color",
      14: "value"
    };
    return modes[mode] || "normal";
  }

  async write(_imageData: ImageData): Promise<ArrayBuffer> {
    throw new Error("XCF writing not implemented.");
  }
}
