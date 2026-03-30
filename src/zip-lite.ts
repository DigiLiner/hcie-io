/**
 * @file zip-lite.ts
 * @description A lightweight, dependency-free (using native DecompressionStream) PKZIP reader.
 * Designed for extracting Krita (.kra) file contents.
 */

export interface ZipEntry {
  filename: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  dataOffset?: number;
}

export class ZipLite {
  private view: DataView;
  private buffer: ArrayBuffer;
  private entries: Map<string, ZipEntry> = new Map();

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.parse();
  }

  private parse() {
    // 1. Find End of Central Directory Record (EOCD)
    let eocdOffset = this.buffer.byteLength - 22;
    while (eocdOffset >= 0) {
      if (this.view.getUint32(eocdOffset, true) === 0x06054b50) break;
      eocdOffset--;
    }

    if (eocdOffset < 0) throw new Error("Not a valid ZIP file (EOCD not found).");

    const cdCount = this.view.getUint16(eocdOffset + 10, true);
    const cdOffset = this.view.getUint32(eocdOffset + 16, true);

    // 2. Parse Central Directory
    let currentOffset = cdOffset;
    for (let i = 0; i < cdCount; i++) {
        const sig = this.view.getUint32(currentOffset, true);
        if (sig !== 0x02014b50) break;

        const compressionMethod = this.view.getUint16(currentOffset + 10, true);
        const compressedSize = this.view.getUint32(currentOffset + 20, true);
        const uncompressedSize = this.view.getUint32(currentOffset + 24, true);
        const filenameLength = this.view.getUint16(currentOffset + 28, true);
        const extraLength = this.view.getUint16(currentOffset + 30, true);
        const commentLength = this.view.getUint16(currentOffset + 32, true);
        const localHeaderOffset = this.view.getUint32(currentOffset + 42, true);

        const filenameBuffer = this.buffer.slice(currentOffset + 46, currentOffset + 46 + filenameLength);
        const filename = new TextDecoder().decode(filenameBuffer);

        this.entries.set(filename, {
            filename,
            compressionMethod,
            compressedSize,
            uncompressedSize,
            localHeaderOffset
        });

        currentOffset += 46 + filenameLength + extraLength + commentLength;
    }
  }

  /**
   * Extracts the content of a file from the ZIP.
   */
  public async extract(filename: string): Promise<Uint8Array | null> {
    const entry = this.entries.get(filename);
    if (!entry) return null;

    let offset = entry.localHeaderOffset;
    if (this.view.getUint32(offset, true) !== 0x04034b50) {
        throw new Error(`Invalid Local File Header for ${filename}`);
    }

    const nameLen = this.view.getUint16(offset + 26, true);
    const extraLen = this.view.getUint16(offset + 28, true);
    const dataOffset = offset + 30 + nameLen + extraLen;
    const compressedData = new Uint8Array(this.buffer, dataOffset, entry.compressedSize);

    if (entry.compressionMethod === 0) {
      // Stored (no compression)
      return new Uint8Array(compressedData);
    } else if (entry.compressionMethod === 8) {
      // Deflate
      // Using browser-native DecompressionStream
      if (typeof DecompressionStream === 'undefined') {
        throw new Error("DecompressionStream is not supported in this environment.");
      }
      
      const ds = new (window as any).DecompressionStream('deflate-raw');
      const response = new Response(compressedData);
      const decompressedStream = response.body?.pipeThrough(ds);
      if (!decompressedStream) throw new Error("Could not create decompressed stream");
      
      const decompressedArrayBuffer = await new Response(decompressedStream).arrayBuffer();
      return new Uint8Array(decompressedArrayBuffer);
    } else {
      throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
    }
  }

  public getFilenames(): string[] {
    return Array.from(this.entries.keys());
  }
}
