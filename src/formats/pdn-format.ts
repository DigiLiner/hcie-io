/**
 * @file pdn-format.ts
 * @description Paint.NET (.pdn) image format adapter.
 * Initial implementation for reading PDN metadata and preview.
 */

import { IImageFormat, DecodedImage } from "../format-interface";

export class PdnFormat implements IImageFormat {
  readonly name = "Paint.NET";
  readonly extensions = [".pdn"];
  readonly canRead = true;
  readonly canWrite = false;

  async read(buffer: ArrayBuffer): Promise<DecodedImage> {
    const view = new DataView(buffer);
    const magic = new TextDecoder().decode(buffer.slice(0, 4));
    
    if (magic !== "PDN3") {
        // PDN files are often GZipped. If it doesn't start with PDN3, try decompressing first.
        try {
            const decompressed = await this.decompressGzip(buffer);
            return this.read(decompressed);
        } catch (e) {
            throw new Error("Not a valid Paint.NET file.");
        }
    }

    // PDN structure (v3+):
    // PDN3 signature
    // XML Metadata (UTF-8)
    // Binary chunks
    
    // Finding the XML segment
    // Usually starts right after PDN3 if not compressed? 
    // Actually, Paint.NET .pdn files are usually fully GZipped.
    
    throw new Error("Full PDN parsing requires NRBF (Binary Serialization) support, which is not yet implemented.");
  }

  private async decompressGzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(buffer);
    writer.close();
    
    const response = new Response(ds.readable);
    return await response.arrayBuffer();
  }

  async write(_imageData: ImageData): Promise<ArrayBuffer> {
    throw new Error("PDN writing not implemented.");
  }
}
