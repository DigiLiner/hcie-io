/**
 * @file webp-format.ts
 * @description WebP image format adapter using native browser capabilities.
 */

import { IImageFormat } from "../format-interface";

export class WebpFormat implements IImageFormat {
  readonly name = "WebP";
  readonly extensions = [".webp"];
  readonly canRead = true;
  readonly canWrite = true;

  async read(buffer: ArrayBuffer): Promise<ImageData[]> {
    const blob = new Blob([buffer], { type: "image/webp" });
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
      canvas.toBlob((b) => resolve(b), "image/webp", 0.8);
    });

    if (!blob) throw new Error("WebP encoding failed.");
    return await blob.arrayBuffer();
  }
}
