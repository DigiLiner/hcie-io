import * as fs from 'fs';
import * as path from 'path';

const testDir = './io-format-tests';
const xcfFile = path.join(testDir, 'gimp-color_test_1.xcf');
const buffer = fs.readFileSync(xcfFile);
const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

console.log("XCF Header Info:");
const magic = new TextDecoder().decode(buffer.slice(0, 9));
const versionStr = new TextDecoder().decode(buffer.slice(9, 13));
const version = parseInt(versionStr.substring(1), 10);
const is64Bit = version >= 11;
console.log(`- Magic: "${magic}"`);
console.log(`- Version: ${versionStr} (parsed: ${version}), 64-bit: ${is64Bit}`);

const width = view.getUint32(14);
const height = view.getUint32(18);
const base_type = view.getUint32(22);
console.log(`- Canvas: ${width}x${height}, type: ${base_type}`);

let current = 26;
if (is64Bit) {
  const precision = view.getUint32(26);
  console.log(`- Precision: ${precision}`);
  current = 30;
}

console.log("\nImage Properties:");
while (current < buffer.byteLength - 8) {
  const propType = view.getUint32(current);
  const propLen = view.getUint32(current + 4);
  let valStr = "";
  if (propType === 17) { // PROP_COMPRESSION
    valStr = ` (Value: ${view.getUint8(current + 8)})`;
  }
  console.log(`- Offset ${current}: Type=${propType}, Len=${propLen}${valStr}`);
  if (propType === 0) { // PROP_END
    current += 8;
    break;
  }
  current += 8 + propLen;
}

console.log(`\nLayer List Pointers (starting offset ${current}):`);
const offsetSize = is64Bit ? 8 : 4;
const layerPtrs: bigint[] = [];
for (let i = 0; i < 5; i++) {
  const ptr = is64Bit ? view.getBigUint64(current) : BigInt(view.getUint32(current));
  console.log(`- Pointer ${i} at ${current}: ${ptr}`);
  if (ptr === 0n) break;
  layerPtrs.push(ptr);
  current += offsetSize;
}

if (layerPtrs.length > 0) {
    const lOffset = Number(layerPtrs[0]);
    console.log(`\nInspecting First Layer at ${lOffset}:`);
    const lWidth = view.getUint32(lOffset);
    const lHeight = view.getUint32(lOffset + 4);
    const lType = view.getUint32(lOffset + 8);
    const lNameLen = view.getUint32(lOffset + 12);
    console.log(`- Dimensions: ${lWidth}x${lHeight}, Type: ${lType}, NameLen: ${lNameLen}`);
    
    let lCurrent = lOffset + 16 + lNameLen;
    console.log(`- Layer Properties:`);
    while (lCurrent < buffer.byteLength - 8) {
        const pType = view.getUint32(lCurrent);
        const pLen = view.getUint32(lCurrent + 4);
        console.log(`  - Offset ${lCurrent}: Type=${pType}, Len=${pLen}`);
        if (pType === 0) {
            lCurrent += 8;
            break;
        }
        lCurrent += 8 + pLen;
    }
    
    const hPtr = is64Bit ? Number(view.getBigUint64(lCurrent)) : view.getUint32(lCurrent);
    console.log(`\n- Hierarchy at ${hPtr}:`);
    const hWidth = view.getUint32(hPtr);
    const hHeight = view.getUint32(hPtr + 4);
    const hBpp = view.getUint32(hPtr + 8);
    const lvPtr = is64Bit ? Number(view.getBigUint64(hPtr + 12)) : view.getUint32(hPtr + 12);
    console.log(`  - Dimensions: ${hWidth}x${hHeight}, BPP: ${hBpp}, LevelPtr: ${lvPtr}`);
    
    console.log(`\n- Level 0 at ${lvPtr}:`);
    const lvWidth = view.getUint32(lvPtr);
    const lvHeight = view.getUint32(lvPtr + 4);
    console.log(`  - Dimensions: ${lvWidth}x${lvHeight}`);
    
    const tPtr0 = is64Bit ? Number(view.getBigUint64(lvPtr + 8)) : view.getUint32(lvPtr + 8);
    console.log(`  - First Tile Ptr: ${tPtr0}`);
    
    if (tPtr0 > 0) {
        const dump = buffer.slice(tPtr0, tPtr0 + 64);
        console.log(`  - Tile Data Hex: ${Array.from(new Uint8Array(dump)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
}
