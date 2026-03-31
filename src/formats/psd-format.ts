import { IImageFormat, DecodedImage } from "../format-interface";
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

  async read(buffer: ArrayBuffer): Promise<DecodedImage> {
    const psdObj = await loadPsdFile(buffer);
    if (!psdObj) throw new Error("Failed to parse PSD");

    const decodedLayers = await convertPsdToLayers(psdObj);
    // Use the first layer's canvas dimensions if available
    const width = decodedLayers[0]?.canvas?.width || 0;
    const height = decodedLayers[0]?.canvas?.height || 0;

    // Convert OffscreenCanvas to HTMLCanvasElement if necessary
    const convertedLayers = decodedLayers.map(layer => {
      let canvas = layer.canvas;
      if (canvas instanceof OffscreenCanvas) {
        // Convert to HTMLCanvasElement
        canvas = convertOffscreenCanvasToHTMLCanvas(canvas);
      }
      return {
        ...layer,
        canvas: canvas
      };
    });
    return {
      width,
      height,
      layers: convertedLayers.map(layer => ({
        name: layer.name,
        canvas: layer.canvas,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        x: 0, y: 0
      }))
    };
  }

  async write(imageData: ImageData): Promise<ArrayBuffer> {
    // Create a mock layer for ag-psd
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D context");
    ctx.putImageData(imageData, 0, 0);

    const mockLayer: any = {
      name: "Background",
      canvas: canvas,
      opacity: 1,
      visible: true,
      blendMode: "source-over",
      width: canvas.width,
      height: canvas.height
    };

    const bytes = await savePsdFile([mockLayer]);
    if (!bytes) throw new Error("Failed to encode PSD");
    return bytes.buffer as ArrayBuffer;
  }
}
