import { IImageFormat } from "../format-interface";
import { loadPsdFile, convertPsdToLayers, savePsdFile } from "../psd-handler";
import { g } from "@hcie/core";

/**
 * Adapter for PSD files, wrapping the existing psd-handler.ts logic.
 */
export class PsdFormat implements IImageFormat {
  readonly name = "Photoshop Document";
  readonly extensions = [".psd"];
  canRead = true;
  canWrite = true;

  async read(buffer: ArrayBuffer): Promise<ImageData[]> {
    const psdObj = await loadPsdFile(buffer);
    if (!psdObj) throw new Error("Failed to parse PSD");

    const layers = await convertPsdToLayers(psdObj);
    return layers.map(layer => {
      const ctx = layer.ctx as CanvasRenderingContext2D;
      return ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    });
  }

  async write(imageData: ImageData): Promise<ArrayBuffer> {
    // Current psd-handler.ts savePsdFile takes an array of ILayer.
    // Since IImageFormat.write currently only takes a single ImageData,
    // we wrap it into a temporary layer for saving.
    
    // Create a mock layer for ag-psd
    const mockLayer: any = {
      name: "Background",
      canvas: document.createElement("canvas"),
      opacity: 1,
      visible: true,
      blendMode: "source-over"
    };
    mockLayer.canvas.width = imageData.width;
    mockLayer.canvas.height = imageData.height;
    const ctx = mockLayer.canvas.getContext("2d");
    if (ctx) ctx.putImageData(imageData, 0, 0);

    const bytes = await savePsdFile([mockLayer]);
    if (!bytes) throw new Error("Failed to encode PSD");
    return bytes.buffer as ArrayBuffer;
  }
}
