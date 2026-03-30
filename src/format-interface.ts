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
   * Reads a file from a binary buffer and returns one or more layers.
   * Multi-layer formats return an array; single-layer formats return a single-element array.
   */
  read(buffer: ArrayBuffer): Promise<ImageData[]>;

  /**
   * Writes image data to a binary buffer in the specific format.
   * @param imageData The image data to write.
   * @param options Format-specific options (e.g., { quality: 80 }).
   */
  write(imageData: ImageData, options?: any): Promise<ArrayBuffer>;
}
