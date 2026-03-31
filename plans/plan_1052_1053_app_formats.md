# Plan #1052 & #1053 – GIMP (.xcf) & Paint.NET (.pdn) Layered Support

## Goal
Implement layered reading of GIMP (.xcf) and Paint.NET (.pdn) files.

## Status
- [🔴] **In Progress**: Researching binary structure and RLE compression for GIMP (.xcf) version 10+. 🔴

## Architecture

### GIMP (.xcf) Structure
- Header: Version info, width, height, color mode.
- Property Chunks: Opacity, visibility, blending modes.
- Layer Chunks: Title, hierarchy.
- Tiles: RLE-compressed or raw pixel data for each layer.

### Paint.NET (.pdn) Structure
- XML Metadata for layer hierarchy.
- Binary segments for layer/mask data (often ZLIB compressed).

### Implementation Strategy
1. **Research**: Determine if specialized JS libraries (e.g., `xcf.js` or `pdn-reader`) are FOSS and offline-compatible.
2. **XcfFormat Adapter**:
   - `read(buffer)`: Parse binary segments into HCIE layers.
   - Support for basic raster layers and blending mode mapping.
3. **PdnFormat Adapter**:
   - `read(buffer)`: Extract XML structure and binary pixel data.

## Verification Plan

### Manual
- Open `.xcf` and `.pdn` files with multiple layers and verify:
  - Correct layer order and transparency.
  - Blending mode compatibility (Mapping to closest HCIE mode).

### Risks
- High complexity: Both formats have many evolved versions. Focus on the most common versions first.
