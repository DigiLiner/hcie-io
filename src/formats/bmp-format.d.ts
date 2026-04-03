/**
 * @file bmp-format.ts
 * @description BMP image format adapter using native browser capabilities for reading.
 */
import { IImageFormat, DecodedImage } from "../format-interface";
export declare class BmpFormat implements IImageFormat {
    readonly name = "Bitmap";
    readonly extensions: string[];
    readonly canRead = true;
    readonly canWrite = true;
    read(buffer: ArrayBuffer): Promise<DecodedImage>;
    write(data: ImageData | DecodedImage): Promise<ArrayBuffer>;
}
