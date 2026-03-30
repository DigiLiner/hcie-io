/**
 * @file krita-tiles.ts
 * @description Parser for Krita's internal tiled binary format (.defaultpixel, layer data).
 */

export class KritaTiles {
  /**
   * Decompress LZF data.
   * Krita uses a standard liblzf-compatible format.
   */
  static decompressLZF(input: Uint8Array, startOffset: number, output: Uint8Array, outputOffset: number, maxBytes: number): number[] {
    let i = startOffset;
    let j = outputOffset;
    const outputLimit = outputOffset + maxBytes;
    
    while (i < input.length && j < outputLimit) {
      const ctrl = input[i++];

      if (ctrl < 32) {
        // Literal run
        let len = ctrl + 1;
        if (j + len > outputLimit) len = outputLimit - j;
        for (let k = 0; k < len; k++) output[j++] = input[i++];
      } else {
        // Back-reference
        let len = ctrl >> 5;
        let offset = ((ctrl & 0x1f) << 8);
        if (i < input.length) offset += input[i++];
        
        if (len === 7 && i < input.length) {
          len += input[i++];
        }
        len += 2;

        const start = j - offset - 1;
        if (start < outputOffset) {
            // Invalid reference, skip
            j += len;
            continue;
        }

        for (let k = 0; k < len; k++) {
          if (j < outputLimit && (start + k) < j) {
              output[j] = output[start + k];
              j++;
          }
        }
      }
    }
    return [i, j - outputOffset]; // [newInputIdx, writtenBytes]
  }

  /**
   * Parses a Krita Tiled binary buffer into ImageData.
   */
  static parse(buffer: Uint8Array, width: number, height: number): ImageData {
    // 1. Parse Header (ASCII until DATA keyword)
    const headerLimit = Math.min(buffer.length, 2048);
    const headerString = new TextDecoder().decode(buffer.subarray(0, headerLimit));
    const lines = headerString.split('\n');
    
    let tileWidth = 64;
    let tileHeight = 64;
    let pixelSize = 4;
    let dataOffset = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('TILEWIDTH')) tileWidth = parseInt(line.split(/\s+/)[1], 10);
        if (line.startsWith('TILEHEIGHT')) tileHeight = parseInt(line.split(/\s+/)[1], 10);
        if (line.startsWith('PIXELSIZE')) pixelSize = parseInt(line.split(/\s+/)[1], 10);
    }

    // 1. Find the DATA keyword and the subsequent newline
    const dataMarker = [0x44, 0x41, 0x54, 0x41]; // 'D', 'A', 'T', 'A'
    for (let j = 0; j <= headerLimit - 4; j++) {
        if (buffer[j] === dataMarker[0] && buffer[j+1] === dataMarker[1] &&
            buffer[j+2] === dataMarker[2] && buffer[j+3] === dataMarker[3]) {
            
            // After finding "DATA", skip until the first newline (0x0A)
            let k = j + 4;
            while (k < headerLimit && buffer[k] !== 0x0A) {
                k++;
            }
            if (k < headerLimit) {
                dataOffset = k + 1;
                break;
            }
        }
    }

    // Diagnostic Dump
    const dump = Array.from(buffer.subarray(0, 128)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const dumpAscii = new TextDecoder().decode(buffer.subarray(0, 128)).replace(/[^\x20-\x7E]/g, '.');
    console.log("[KritaTiles] Header Dump (Hex):", dump);
    console.log("[KritaTiles] Header Dump (ASCII):", dumpAscii);

    if (dataOffset === -1) {
        console.error("[KritaTiles] Header Parsing Failed. TileSize:", tileWidth, "x", tileHeight, "Offset:", dataOffset);
        throw new Error("Invalid Krita Tile format: DATA marker not found.");
    }

    console.log(`[KritaTiles] Parsing ${width}x${height} layer. TileSize: ${tileWidth}x${tileHeight}, PixelSize: ${pixelSize}, DataOffset: ${dataOffset}`);

    // 2. Prepare output
    const imageData = new ImageData(width, height);
    const pixels = imageData.data;
    let offset = dataOffset;

    console.log(`[KritaTiles] Starting tile processing. Document: ${width}x${height}, Tile: ${tileWidth}x${tileHeight}, PixelSize: ${pixelSize}`);

    // 3. Process Tiles
    // In Krita VERSION 2, tiles have ASCII headers: "x,y,compression,length\n"
    while (offset < buffer.length) {
        // Find end of the ASCII line for this tile
        let lineEnd = offset;
        while (lineEnd < buffer.length && buffer[lineEnd] !== 0x0A) {
            lineEnd++;
        }
        if (lineEnd >= buffer.length) break;

        const tileHeader = new TextDecoder().decode(buffer.subarray(offset, lineEnd)).trim();
        offset = lineEnd + 1; // Move past \n
        if (!tileHeader) continue;

        const parts = tileHeader.split(',');
        if (parts.length < 4) continue;

        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        const compression = parts[2].trim(); // "LZF" or "None"
        const length = parseInt(parts[3], 10);

        if (offset + length > buffer.length) {
            console.warn(`[KritaTiles] DATA OVERRUN: Tile at ${x},${y} wants ${length} bytes, but only ${buffer.length - offset} remain.`);
            break;
        }

        const tilePayload = buffer.subarray(offset, offset + length);
        const planeSize = tileWidth * tileHeight;
        const tileData = new Uint8Array(planeSize * pixelSize);

        if (compression === 'LZF') {
            const [bytesRead, dLen] = (this as any).decompressLZF(tilePayload, 1, tileData, 0, tileData.length + 8192); // Allow extra space for header
            
            // Krita 5.x tiles typically have an internal metadata header before the pixel data.
            // The pixel data (planar) is at the end of the decompressed block.
            let skip = 0;
            const expectedSize = planeSize * pixelSize;
            if (dLen > expectedSize) {
                skip = dLen - expectedSize;
            }

            // Undo Planar Horizontal Delta (Accumulative sum)
            // Krita 5.x uses this to improve LZF compression.
            for (let c = 0; c < pixelSize; c++) {
                const planeStart = skip + c * planeSize;
                for (let i = 1; i < planeSize; i++) {
                    tileData[planeStart + i] = (tileData[planeStart + i] + tileData[planeStart + i - 1]) & 0xFF;
                }
            }

            // Copy to ImageData: Interleave Planar channels
            for (let ty = 0; ty < tileHeight; ty++) {
                for (let tx = 0; tx < tileWidth; tx++) {
                    const targetX = x + tx;
                    const targetY = y + ty;
                    
                    if (targetX < width && targetY < height) {
                        const targetIdx = (targetY * width + targetX) * 4;
                        const srcIdx = skip + ty * tileWidth + tx;
                        
                        if (pixelSize === 4) {
                            // Krita RGBA8 is typically B, G, R, A in planar channels
                            pixels[targetIdx + 0] = tileData[srcIdx + 2 * planeSize]; // R
                            pixels[targetIdx + 1] = tileData[srcIdx + 1 * planeSize]; // G
                            pixels[targetIdx + 2] = tileData[srcIdx + 0 * planeSize]; // B
                            pixels[targetIdx + 3] = tileData[srcIdx + 3 * planeSize]; // A
                        } else if (pixelSize === 1) {
                            pixels[targetIdx + 0] = pixels[targetIdx + 1] = pixels[targetIdx + 2] = tileData[srcIdx];
                            pixels[targetIdx + 3] = 255;
                        } else if (pixelSize === 2) {
                            pixels[targetIdx + 0] = pixels[targetIdx + 1] = pixels[targetIdx + 2] = tileData[srcIdx];
                            pixels[targetIdx + 3] = tileData[srcIdx + planeSize];
                        }
                    }
                }
            }
        } else {
            tileData.set(tilePayload.subarray(0, Math.min(tilePayload.length, planeSize * pixelSize)));
            // ... (uncompressed path fallback)
        }
        offset += length;
    }
    return imageData;
  }
}

