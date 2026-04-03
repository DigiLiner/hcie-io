/**
 * @file webp-format.ts
 * @description WebP image format adapter using native browser capabilities.
 */
import { IImageFormat, DecodedImage } from "../format-interface";
export declare class WebpFormat implements IImageFormat {
    readonly name = "WebP";
    readonly extensions: string[];
    readonly canRead = true;
    readonly canWrite = true;
    read(buffer: ArrayBuffer): Promise<DecodedImage>;
    write(data: ImageData | DecodedImage): Promise<ArrayBuffer>;
}
