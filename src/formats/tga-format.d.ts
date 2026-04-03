/**
 * @file tga-format.ts
 * @description TGA image format adapter supporting uncompressed 24/32-bit read/write.
 */
import { IImageFormat, DecodedImage } from "../format-interface";
export declare class TgaFormat implements IImageFormat {
    readonly name = "Targa";
    readonly extensions: string[];
    readonly canRead = true;
    readonly canWrite = true;
    read(buffer: ArrayBuffer): Promise<DecodedImage>;
    private setPixel;
    write(data: ImageData | DecodedImage): Promise<ArrayBuffer>;
}
