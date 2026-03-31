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
console.log("\nImage Properties:");
while (current < buffer.byteLength - 8) {
  const propType = view.getUint32(current);
  const propLen = view.getUint32(current + 4);
  console.log(`- Offset ${current}: Type=${propType}, Len=${propLen}`);
  if (propType === 0) { // PROP_END
    current += 8;
    break;
  }
  current += 8 + propLen;
}

console.log(`\nLayer List Pointers (starting offset ${current}):`);
const offsetSize = is64Bit ? 8 : 4;
for (let i = 0; i < 5; i++) {
  const ptr = is64Bit ? view.getBigUint64(current) : view.getUint32(current);
  console.log(`- Pointer ${i} at ${current}: ${ptr}`);
  if (ptr === 0n || ptr === 0) break;
  current += offsetSize;
}
