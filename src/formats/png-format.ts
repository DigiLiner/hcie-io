import { IImageFormat } from "../format-interface";

/**
 * Adapter for reading and writing PNG images using the browser's Canvas API.
 */
export class PngFormat implements IImageFormat {
  readonly name = "PNG Images";
  readonly extensions = [".png"];
  canRead = true;
  canWrite = true;

  /**
   * Reads a PNG file by creating an ImageBitmap from the blob.
   */
  async read(buffer: ArrayBuffer): Promise<ImageData[]> {
    const blob = new Blob([buffer], { type: "image/png" });
    const bitMap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitMap.width;
    canvas.height = bitMap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D context");
    ctx.drawImage(bitMap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return [imageData];
  }

  /**
   * Writes a PNG file by drawing it to a canvas and converting it to a blob.
   */
  async write(imageData: ImageData): Promise<ArrayBuffer> {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D context");
    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });

    if (!blob) throw new Error("Failed to encode PNG");
    return await blob.arrayBuffer();
  }
}
