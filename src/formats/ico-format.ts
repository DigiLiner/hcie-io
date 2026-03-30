/**
 * @file ico-format.ts
 * @description Windows Icon (ICO) format adapter. Supports reading images from ICO files.
 */

import { IImageFormat } from "../format-interface";

export class IcoFormat implements IImageFormat {
  readonly name = "Window Icon";
  readonly extensions = [".ico", ".cur"];
  readonly canRead = true;
  readonly canWrite = false; // ICO writing is complex, focus on reading

  async read(buffer: ArrayBuffer): Promise<ImageData[]> {
    const view = new DataView(buffer);
    const reserved = view.getUint16(0, true);
    const type = view.getUint16(2, true); // 1 = ICO, 2 = CUR
    const count = view.getUint16(4, true);
    
    if (reserved !== 0 || (type !== 1 && type !== 2)) {
      throw new Error("Invalid ICO file header.");
    }

    const images: ImageData[] = [];
    
    // Parse entries
    for (let i = 0; i < count; i++) {
        const offsetEntry = 6 + i * 16;
        const width = view.getUint8(offsetEntry) || 256;
        const height = view.getUint8(offsetEntry + 1) || 256;
        const bytes = view.getUint32(offsetEntry + 8, true);
        const offset = view.getUint32(offsetEntry + 12, true);
        
        const imgData = buffer.slice(offset, offset + bytes);
        const uint8 = new Uint8Array(imgData);
        
        // ICO images are either PNG (starts with 0x89 0x50 0x4E 0x47) or BMP (starts with DIB header, NO "BM")
        let blob: Blob;
        if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
            blob = new Blob([imgData], { type: "image/png" });
        } else {
            // It's a DIB, we need to wrap it into a full BMP (add "BM" header)
            // Or use a more direct way. For simplicity, we can try creating a fake BMP header.
            // But browser might NOT support BMP-without-file-header directly in createImageBitmap.
            
            // Standard BMP file header is 14 bytes.
            const fullBmp = new Uint8Array(14 + uint8.length);
            const dv = new DataView(fullBmp.buffer);
            dv.setUint16(0, 0x4D42, true); // "BM"
            dv.setUint32(2, fullBmp.length, true);
            
            // Offset to pixels is 14 + DIB Header size (usually 40)
            // BMPs in ICO often omit the file header but keep the DIB header.
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
                images.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            }
        } catch (e) {
            console.warn(`Failed to parse ICO image entry ${i}:`, e);
        }
    }

    if (images.length === 0) throw new Error("No valid images found in ICO file.");
    
    // Return all images (layers)
    return images;
  }

  async write(_imageData: ImageData): Promise<ArrayBuffer> {
    throw new Error("ICO writing not implemented.");
  }
}
