import { IImageFormat, DecodedImage } from "../format-interface";
/**
 * Adapter for reading and writing Photoshop PSD files.
 * Reading is done via psd.js, writing via ag-psd.
 */
export declare class PsdFormat implements IImageFormat {
    readonly name = "Adobe Photoshop";
    readonly extensions: string[];
    canRead: boolean;
    canWrite: boolean;
    /**
     * Reads a PSD file using the shared psd-handler.
     */
    read(buffer: ArrayBuffer): Promise<DecodedImage>;
    write(data: ImageData | DecodedImage): Promise<ArrayBuffer>;
}
