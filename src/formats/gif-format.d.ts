/**
 * @file gif-format.ts
 * @description GIF image format adapter using native browser capabilities for single-frame reading.
 */
import { IImageFormat, DecodedImage } from "../format-interface";
export declare class GifFormat implements IImageFormat {
    readonly name = "GIF Image";
    readonly extensions: string[];
    readonly canRead = true;
    readonly canWrite = true;
    read(buffer: ArrayBuffer): Promise<DecodedImage>;
    write(data: ImageData | DecodedImage): Promise<ArrayBuffer>;
}
