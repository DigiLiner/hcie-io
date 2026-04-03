import { IImageFormat, DecodedImage } from "../format-interface";
/**
 * Adapter for reading and writing PNG images using the browser's Canvas API.
 */
export declare class PngFormat implements IImageFormat {
    readonly name = "PNG Images";
    readonly extensions: string[];
    canRead: boolean;
    canWrite: boolean;
    /**
     * Reads a PNG file by creating an ImageBitmap from the blob.
     */
    read(buffer: ArrayBuffer): Promise<DecodedImage>;
    /**
     * Writes a PNG file by drawing it to a canvas and converting it to a blob.
     */
    write(data: ImageData | DecodedImage): Promise<ArrayBuffer>;
}
