import { CanvasLike } from '@hcie/shared';
/**
 * Represents a single layer in DecodedImage.
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
 * Represents the structure returned after reading an image format.
 */
export interface DecodedImage {
    width: number;
    height: number;
    layers: LayerData[];
    /**
     * Pre-rendered/flattened composite image for compatibility.
     */
    composite?: ImageData;
}
/**
 * Filter definition for file dialogs.
 */
export interface FileFilter {
    name: string;
    extensions: string[];
}
/**
 * Common interface for all image format adapters (PNG, JPEG, PSD, etc.).
 */
export interface IImageFormat {
    readonly name: string;
    readonly extensions: string[];
    readonly canRead: boolean;
    readonly canWrite: boolean;
    /**
     * Reads an image from an ArrayBuffer and returns a DecodedImage.
     * @param buffer The input binary data.
     */
    read(buffer: ArrayBuffer): Promise<DecodedImage>;
    /**
     * Writes an image to an ArrayBuffer.
     * @param data The image data or layered document to write.
     * @param options Format-specific options (e.g., { quality: 80 }).
     */
    write(data: ImageData | DecodedImage, options?: any): Promise<ArrayBuffer>;
}
