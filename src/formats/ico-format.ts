/**
 * @file ico-format.ts
 * @description Windows Icon (ICO) format adapter. Supports reading images from ICO files.
 */

import { IImageFormat, DecodedImage } from "../format-interface";

export class IcoFormat implements IImageFormat {
  readonly name = "Window Icon";
  readonly extensions = [".ico", ".cur"];
  readonly canRead = true;
  readonly canWrite = false;

  async read(buffer: ArrayBuffer): Promise<DecodedImage> {
    const view = new DataView(buffer);
    const reserved = view.getUint16(0, true);
    const type = view.getUint16(2, true); // 1 = ICO, 2 = CUR
    const count = view.getUint16(4, true);
    
    if (reserved !== 0 || (type !== 1 && type !== 2)) {
      throw new Error("Invalid ICO file header.");
    }

    const layers: any[] = [];
    let maxWidth = 0;
    let maxHeight = 0;
    
    // Parse entries
    for (let i = 0; i < count; i++) {
        const offsetEntry = 6 + i * 16;
        const width = view.getUint8(offsetEntry) || 256;
        const height = view.getUint8(offsetEntry + 1) || 256;
        const bytes = view.getUint32(offsetEntry + 8, true);
        const offset = view.getUint32(offsetEntry + 12, true);
        
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);

        const imgData = buffer.slice(offset, offset + bytes);
        const uint8 = new Uint8Array(imgData);
        
        let blob: Blob;
        if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
            blob = new Blob([imgData], { type: "image/png" });
        } else {
            // DIB to BMP
            const fullBmp = new Uint8Array(14 + uint8.length);
            const dv = new DataView(fullBmp.buffer);
            dv.setUint16(0, 0x4D42, true); // "BM"
            dv.setUint32(2, fullBmp.length, true);
            const dibSize = view.getUint32(offset, true);
            dv.setUint32(10, 14 + dibSize, true);
            fullBmp.set(uint8, 14);
            blob = new Blob([fullBmp], { type: "image/bmp" });
        }
        
        try {
            const bitmap = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(bitmap, 0, 0);
                layers.push({
                    name: `Icon ${width}x${height}`,
                    canvas: ctx.getImageData(0, 0, canvas.width, canvas.height),
                    visible: true,
                    opacity: 1,
                    blendMode: "source-over",
                    x: 0, y: 0
                });
            }
        } catch (e) {
            console.warn(`Failed to parse ICO entry ${i}:`, e);
        }
    }

    if (layers.length === 0) throw new Error("No valid images found in ICO file.");
    
    return {
      width: maxWidth,
      height: maxHeight,
      layers
    };
  }

  async write(_imageData: ImageData): Promise<ArrayBuffer> {
    throw new Error("ICO writing not implemented.");
  }
}
