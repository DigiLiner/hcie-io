import { IImageFormat, DecodedImage } from "../format-interface";
/**
 * Adapter for reading and writing JPEG images using the browser's Canvas API.
 */
export declare class JpegFormat implements IImageFormat {
    readonly name = "JPEG Images";
    readonly extensions: string[];
    canRead: boolean;
    canWrite: boolean;
    /**
     * Reads a JPEG file by creating an ImageBitmap from the blob.
     */
    read(buffer: ArrayBuffer): Promise<DecodedImage>;
    /**
     * Writes a JPEG file by drawing it to a canvas and converting it to a blob.
     */
    write(data: ImageData | DecodedImage, options?: {
        quality?: number;
    }): Promise<ArrayBuffer>;
}
