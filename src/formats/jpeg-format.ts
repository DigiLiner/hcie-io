import { IImageFormat, DecodedImage } from "../format-interface";
import { ensureFlatImage } from "./utils";

/**
 * Adapter for reading and writing JPEG images using the browser's Canvas API.
 */
export class JpegFormat implements IImageFormat {
  readonly name = "JPEG Images";
  readonly extensions = [".jpg", ".jpeg"];
  canRead = true;
  canWrite = true;

  /**
   * Reads a JPEG file by creating an ImageBitmap from the blob.
   */
  async read(buffer: ArrayBuffer): Promise<DecodedImage> {
    const blob = new Blob([buffer], { type: "image/jpeg" });
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

  /**
   * Writes a JPEG file by drawing it to a canvas and converting it to a blob.
   */
  async write(data: ImageData | DecodedImage, options: { quality?: number } = {}): Promise<ArrayBuffer> {
    const imageData = ensureFlatImage(data);
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D context");
    ctx.putImageData(imageData, 0, 0);

    // Default quality is 0.92 if not specified.
    const quality = options.quality !== undefined ? options.quality / 100 : 0.92;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) throw new Error("Failed to encode JPEG");
    return await blob.arrayBuffer();
  }
}
