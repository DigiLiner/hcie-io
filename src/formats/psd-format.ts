import { IImageFormat, DecodedImage } from "../format-interface";
import { savePsdFile, loadPsdFile, convertPsdToLayers } from "../psd-handler";

/**
 * Adapter for reading and writing Photoshop PSD files.
 * Reading is done via psd.js, writing via ag-psd.
 */
export class PsdFormat implements IImageFormat {
  readonly name = "Adobe Photoshop";
  readonly extensions = [".psd"];
  canRead = true;
  canWrite = true;

  /**
   * Reads a PSD file using the shared psd-handler.
   */
  async read(buffer: ArrayBuffer): Promise<DecodedImage> {
    const psdObj = await loadPsdFile(buffer);
    if (!psdObj) throw new Error("Failed to load PSD file.");

    const layers = await convertPsdToLayers(psdObj);
    if (!layers || layers.length === 0) {
      throw new Error("No layers found in PSD file.");
    }

    const firstLayer = layers[0];
    const width = (psdObj as any).width || (psdObj as any).tree?.().width || firstLayer.canvas.width;
    const height = (psdObj as any).height || (psdObj as any).tree?.().height || firstLayer.canvas.height;

    // Map LayerClass array to DecodedLayer array
    return {
      width,
      height,
      layers: layers.map((l: any) => ({
        name: l.name,
        canvas: l.canvas,
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        x: (l as any).x || 0,
        y: (l as any).y || 0
      }))
    };
  }

  async write(data: ImageData | DecodedImage): Promise<ArrayBuffer> {
    if ((data as DecodedImage).layers) {
        const decoded = data as DecodedImage;
        const bytes = await savePsdFile(decoded.layers, decoded.composite);
        if (!bytes) throw new Error("Failed to encode layered PSD");
        return bytes.buffer as ArrayBuffer;
    }

    // Fallback for single ImageData
    const imageData = data as ImageData;
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
      x: 0,
      y: 0
    };

    const bytes = await savePsdFile([mockLayer]);
    if (!bytes) throw new Error("Failed to encode PSD");
    return bytes.buffer as ArrayBuffer;
  }
}
