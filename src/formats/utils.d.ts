import { DecodedImage } from "../format-interface";
/**
 * Ensures we have a flat ImageData object.
 * If data is already ImageData, returns it.
 * If data is DecodedImage, returns its pre-rendered composite if available,
 * otherwise throws an error (since formats using this helper usually can't self-flatten).
 */
export declare function ensureFlatImage(data: ImageData | DecodedImage): ImageData;
