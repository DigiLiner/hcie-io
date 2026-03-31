/**
 * @file gif-format.ts
 * @description GIF image format adapter using native browser capabilities for single-frame reading.
 */

import { IImageFormat, DecodedImage } from "../format-interface";

export class GifFormat implements IImageFormat {
  readonly name = "GIF Image";
  readonly extensions = [".gif"];
  readonly canRead = true;
  readonly canWrite = true;

  async read(buffer: ArrayBuffer): Promise<DecodedImage> {
    const blob = new Blob([buffer], { type: "image/gif" });
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
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D context");
    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/gif");
    });

    if (!blob) throw new Error("GIF encoding failed.");
    return await blob.arrayBuffer();
  }
}
