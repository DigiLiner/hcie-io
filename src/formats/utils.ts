import { DecodedImage } from "../format-interface";

/**
 * Ensures we have a flat ImageData object. 
 * If data is already ImageData, returns it.
 * If data is DecodedImage, returns its pre-rendered composite if available,
 * otherwise throws an error (since formats using this helper usually can't self-flatten).
 */
export function ensureFlatImage(data: ImageData | DecodedImage): ImageData {
    if (data instanceof ImageData) {
        return data;
    }
    
    // In HCIE, ProjectIO provides the composite when exporting.
    if (data.composite) {
        return data.composite;
    }

    // Fallback: This shouldn't happen with our current ProjectIO implementation
    throw new Error("Format requires a flattened image but received a layered structure without a composite.");
}
