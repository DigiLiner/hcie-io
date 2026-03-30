/**
 * @file gif-format.ts
 * @description GIF image format adapter using native browser capabilities for single-frame reading.
 */

import { IImageFormat } from "../format-interface";

export class GifFormat implements IImageFormat {
  readonly name = "GIF Image";
  readonly extensions = [".gif"];
  readonly canRead = true;
  readonly canWrite = true;

  async read(buffer: ArrayBuffer): Promise<ImageData[]> {
    const blob = new Blob([buffer], { type: "image/gif" });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D context");
    
    ctx.drawImage(bitmap, 0, 0);
    return [ctx.getImageData(0, 0, canvas.width, canvas.height)];
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
