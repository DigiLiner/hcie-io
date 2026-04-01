/**
 * @file webp-format.ts
 * @description WebP image format adapter using native browser capabilities.
 */

import { IImageFormat, DecodedImage } from "../format-interface";
import { ensureFlatImage } from "./utils";

export class WebpFormat implements IImageFormat {
  readonly name = "WebP";
  readonly extensions = [".webp"];
  readonly canRead = true;
  readonly canWrite = true;

  async read(buffer: ArrayBuffer): Promise<DecodedImage> {
    const blob = new Blob([buffer], { type: "image/webp" });
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

  async write(data: ImageData | DecodedImage): Promise<ArrayBuffer> {
    const imageData = ensureFlatImage(data);
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
