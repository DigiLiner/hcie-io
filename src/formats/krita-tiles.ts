/**
 * @file krita-tiles.ts
 * @description Parser for Krita's internal tiled binary format (.defaultpixel, layer data).
 */

import { decompress } from 'lzfjs';

export class KritaTiles {

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

    if (dataOffset === -1) {
        console.error("[KritaTiles] Header Parsing Failed. TileSize:", tileWidth, "x", tileHeight, "Offset:", dataOffset);
        throw new Error("Invalid Krita Tile format: DATA marker not found.");
    }

    console.log(`[KritaTiles] Parsing ${width}x${height} layer. TileSize: ${tileWidth}x${tileHeight}, PixelSize: ${pixelSize}`);

    // 2. Prepare output
    const imageData = new ImageData(width, height);
    const pixels = imageData.data;
    let offset = dataOffset;

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
        offset = lineEnd;
        while (offset < buffer.length && (buffer[offset] === 0x0A || buffer[offset] === 0x0D)) {
            offset++;
        }
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
            const expectedSize = planeSize * pixelSize;
            try {
                // Krita LZF blocks have a 1-byte header indicating version/delta.
                // Version 1: LZF only
                // Version 2: LZF + Planar Delta
                const lzfVersion = tilePayload[0];
                // @ts-ignore - lzfjs lacks typescript definitions by default
                const decompressed = decompress(tilePayload.subarray(1));
                const dLen = decompressed.length;
                
                const skip = dLen > expectedSize ? dLen - expectedSize : 0;
                
                // Copy decompressed data to tileData (only the pixel part)
                tileData.set(decompressed.subarray(skip, skip + expectedSize));

                if (dLen < expectedSize) {
                    console.warn(`[KritaTiles] Tile ${x},${y} short decompression: Got ${dLen}, expected ${expectedSize}`);
                    if (pixelSize === 4) tileData.fill(255, dLen, expectedSize);
                }

                // Undo Planar Horizontal Delta (Accumulative sum)
                if (lzfVersion >= 2) {
                    for (let c = 0; c < pixelSize; c++) {
                        const planeStart = c * planeSize;
                        for (let i = 1; i < planeSize; i++) {
                            tileData[planeStart + i] = (tileData[planeStart + i] + tileData[planeStart + i - 1]) & 0xFF;
                        }
                    }
                }
            } catch (err) {
                console.error(`[KritaTiles] LZF Decompression failed for tile ${x},${y}:`, err);
            }
        } else {
            tileData.set(tilePayload.subarray(0, Math.min(tilePayload.length, planeSize * pixelSize)));
        }

        // Copy to ImageData: Interleave Planar channels
        for (let ty = 0; ty < tileHeight; ty++) {
            for (let tx = 0; tx < tileWidth; tx++) {
                const targetX = x + tx;
                const targetY = y + ty;
                
                if (targetX < width && targetY < height) {
                    const targetIdx = (targetY * width + targetX) * 4;
                    const srcIdx = ty * tileWidth + tx;
                    
                    if (pixelSize === 4) {
                        // Krita RGBA8 is B, G, R, A (planar)
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
        
        offset += length;
    }
    return imageData;
  }
}
