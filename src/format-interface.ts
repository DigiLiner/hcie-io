
import { CanvasLike } from "@hcie/shared";

/**
 * Data structure for a single decoded layer.
 */
export interface LayerData {
  name: string;
  canvas: CanvasLike | ImageData;
  visible: boolean;
  opacity: number;
  blendMode: string;
  x: number;
  y: number;
}

/**
 * Data structure for a decoded multi-layered image.
 */
export interface DecodedImage {
  width: number;
  height: number;
  layers: LayerData[];
}

/**
 * Represents a single image file format (PNG, PSD, etc.)
 */
export interface IImageFormat {
  /**
   * Human-readable name of the format (e.g., "Photoshop Image")
   */
  readonly name: string;

  /**
   * List of file extensions including the dot (e.g., [".psd", ".psb"])
   */
  readonly extensions: string[];

  /**
   * Whether this format is currently capable of reading files
   */
  canRead: boolean;

  /**
   * Whether this format is currently capable of writing files
   */
  canWrite: boolean;

  /**
   * Reads a file from a binary buffer and returns a decoded image object.
   */
  read(buffer: ArrayBuffer): Promise<DecodedImage>;

  /**
   * Writes image data to a binary buffer in the specific format.
   * @param imageData The image data to write.
   * @param options Format-specific options (e.g., { quality: 80 }).
   */
  write(imageData: ImageData, options?: any): Promise<ArrayBuffer>;
}
