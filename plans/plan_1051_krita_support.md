# Plan #1051 – Krita (.kra) Layered Support

## Goal
Implement full layered reading of Krita (.kra) files using `JSZip` and XML parsing. Focus on correctly reconstructing Krita's native tiled binary format for high-quality imports.

## Status
- [🟢] **Done**: Layered reading implemented and verified.
- [🟢] **Fixed**: Corrupted "tiled" image output during binary parsing. Fixed by implementing conditional Planar Delta-decoding based on the LZF version byte (Version 1 = raw, Version 2 = delta). Corrected summation logic to use whole-plane accumulation instead of per-row.

## Debugging Resources
- **Test Folder**: `io-format-tests/`
- **Known Issues**:
  - `krita-debug_test-open-result.png`: Shows scrambled/tiled output, indicating a bug in `krita-tiles.ts`.
  - Binary parser currently fails to correctly reconstruct planar pixels or undo delta encoding properly.

## Architecture

### .kra File Structure (Detailed)
- `mergedimage.png`: Flat preview (used for quick loading/fallback).
- `maindoc.xml`: Primary metadata. Contains `<layer>` elements within an `<image>` tag.
- `layers.xml`: Layer hierarchy, blending modes, visibility (Krita 4.0+).
- `layers/`: Subfolder containing individual parts for each layer.
  - Can be `.png` (standard) or extensionless binary files (Krita Tiled Format).

### Implementation Strategy (Updated)
1. **Binary Parser Debugging (`krita-tiles.ts`)**:
   - Verify LZF decompression logic.
   - Cross-check "Undo Delta" algorithm (horizontal vs. vertical, or if it should exist at all for all planes).
   - Validate planar order (B, G, R, A vs. R, G, B, A).
   - Handle `PIXELSIZE` dynamically (8 for RGBA8, 16 for RGBA16).
2. **Metadata Refinement**:
   - Ensure layer offsets (`x`, `y`) are applied correctly to the canvas.
3. **Integration**:
   - Fallback to `mergedimage.png` only if individual layer parsing fails.

## Verification Plan

### Manual
- Open `io-format-tests/krita-debug_test-image-saved-by-krita.kra`.
- Ensure no "tiled" corruption is visible in the result.

### Risks (Resolved)
- Memory: Managed via sequential tile processing.
- Version 2 format complexity: Handled for standard RGBA8 layers.


