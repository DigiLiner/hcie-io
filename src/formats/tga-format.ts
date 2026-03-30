/**
 * @file tga-format.ts
 * @description TGA image format adapter supporting uncompressed 24/32-bit read/write.
 */

import { IImageFormat } from "../format-interface";

export class TgaFormat implements IImageFormat {
  readonly name = "Targa";
  readonly extensions = [".tga"];
  readonly canRead = true;
  readonly canWrite = true;

  async read(buffer: ArrayBuffer): Promise<ImageData[]> {
    const view = new DataView(buffer);
    const header = {
      idLength: view.getUint8(0),
      colorMapType: view.getUint8(1),
      imageType: view.getUint8(2), // 2 = Uncompressed True-color
      colorMapSpec: null, // Skip
      xOrigin: view.getUint16(8, true),
      yOrigin: view.getUint16(10, true),
      width: view.getUint16(12, true),
      height: view.getUint16(14, true),
      pixelDepth: view.getUint8(16),
      imageDesc: view.getUint8(17),
    };

    if (header.imageType !== 2 && header.imageType !== 10) {
      throw new Error("Only uncompressed (2) and RLE (10) True-color TGA is supported.");
    }

    const isRle = header.imageType === 10;
    const bytesPerPixel = header.pixelDepth / 8;
    const imageData = new ImageData(header.width, header.height);
    const { data } = imageData;
    
    let offset = 18 + header.idLength;
    const totalPixels = header.width * header.height;
    let pixelIndex = 0;

    // TGA is usually bottom-up unless bit 5 of imageDesc is set
    const isTopDown = (header.imageDesc & 0x20) !== 0;

    while (pixelIndex < totalPixels) {
      if (isRle) {
        const chunkHeader = view.getUint8(offset++);
        const count = (chunkHeader & 0x7f) + 1;
        
        if ((chunkHeader & 0x80) !== 0) { // Run-length packet
          const b = view.getUint8(offset++);
          const g = view.getUint8(offset++);
          const r = view.getUint8(offset++);
          const a = bytesPerPixel === 4 ? view.getUint8(offset++) : 255;
          
          for (let i = 0; i < count; i++) {
            this.setPixel(data, pixelIndex++, r, g, b, a, header.width, header.height, isTopDown);
          }
        } else { // Raw packet
          for (let i = 0; i < count; i++) {
            const b = view.getUint8(offset++);
            const g = view.getUint8(offset++);
            const r = view.getUint8(offset++);
            const a = bytesPerPixel === 4 ? view.getUint8(offset++) : 255;
            this.setPixel(data, pixelIndex++, r, g, b, a, header.width, header.height, isTopDown);
          }
        }
      } else { // Uncompressed
        const b = view.getUint8(offset++);
        const g = view.getUint8(offset++);
        const r = view.getUint8(offset++);
        const a = bytesPerPixel === 4 ? view.getUint8(offset++) : 255;
        this.setPixel(data, pixelIndex++, r, g, b, a, header.width, header.height, isTopDown);
      }
    }

    return [imageData];
  }

  private setPixel(data: Uint8ClampedArray, index: number, r: number, g: number, b: number, a: number, w: number, h: number, isTopDown: boolean) {
    const x = index % w;
    const y = Math.floor(index / w);
    const targetY = isTopDown ? y : (h - 1 - y);
    const outIndex = (targetY * w + x) * 4;
    
    data[outIndex] = r;
    data[outIndex+1] = g;
    data[outIndex+2] = b;
    data[outIndex+3] = a;
  }

  async write(imageData: ImageData): Promise<ArrayBuffer> {
    const { width, height, data } = imageData;
    const fileSize = 18 + (width * height * 4);
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    
    // Header (18 bytes)
    view.setUint8(2, 2); // Uncompressed True-color
    view.setUint16(12, width, true);
    view.setUint16(14, height, true);
    view.setUint8(16, 32); // 32-bit (RGBA)
    view.setUint8(17, 0x20); // Top-down
    
    // Pixel Data (BGRA)
    for (let i = 0; i < width * height; i++) {
      const offset = 18 + i * 4;
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const a = data[i * 4 + 3];
      
      view.setUint8(offset + 0, b);
      view.setUint8(offset + 1, g);
      view.setUint8(offset + 2, r);
      view.setUint8(offset + 3, a);
    }
    
    return buffer;
  }
}
