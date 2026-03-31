/**
 * @file bmp-format.ts
 * @description BMP image format adapter using native browser capabilities for reading.
 */

import { IImageFormat, DecodedImage } from "../format-interface";

export class BmpFormat implements IImageFormat {
  readonly name = "Bitmap";
  readonly extensions = [".bmp", ".dib"];
  readonly canRead = true;
  readonly canWrite = true;

  async read(buffer: ArrayBuffer): Promise<DecodedImage> {
    const blob = new Blob([buffer], { type: "image/bmp" });
    const bitMap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitMap.width;
    canvas.height = bitMap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D context");
    ctx.drawImage(bitMap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
      width: canvas.width,
      height: canvas.height,
      layers: [{
        name: "Background",
        canvas: imageData,
        visible: true,
        opacity: 1,
        blendMode: 'source-over',
        x: 0, y: 0
      }]
    };
  }

  async write(imageData: ImageData): Promise<ArrayBuffer> {
    // Some browsers support toBlob("image/bmp"), but many don't.
    // For universal support, we can use a very basic BMP encoder (uncompressed).
    
    const { width, height, data } = imageData;
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = 54 + pixelArraySize;
    
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    
    // File Header (14 bytes)
    view.setUint16(0, 0x4D42, true); // "BM"
    view.setUint32(2, fileSize, true);
    view.setUint32(6, 0, true); // Reserved
    view.setUint32(10, 54, true); // Offset to pixel data
    
    // DIB Header (40 bytes - BITMAPINFOHEADER)
    view.setUint32(14, 40, true);
    view.setUint32(18, width, true);
    view.setUint32(22, height, true); // Positive height = bottom-up
    view.setUint16(26, 1, true); // Planes
    view.setUint16(28, 24, true); // Bits per pixel
    view.setUint32(30, 0, true); // Compression (0 = none)
    view.setUint32(34, pixelArraySize, true);
    view.setUint32(38, 2835, true); // H-Res (72 DPI)
    view.setUint32(42, 2835, true); // V-Res
    view.setUint32(46, 0, true); // Colors in palette
    view.setUint32(50, 0, true); // Important colors
    
    // Pixel Data (BGR, bottom-up)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offsetIn = ((height - 1 - y) * width + x) * 4;
        const offsetOut = 54 + y * rowSize + x * 3;
        
        view.setUint8(offsetOut + 0, data[offsetIn + 2]); // B
        view.setUint8(offsetOut + 1, data[offsetIn + 1]); // G
        view.setUint8(offsetOut + 2, data[offsetIn + 0]); // R
      }
    }
    
    return buffer;
  }
}
