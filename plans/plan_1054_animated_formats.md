# Plan #1054 – Animated GIF & APNG Frame Extraction

## Goal
Implement full frame extraction for animated formats (GIF, APNG) to import them as individual layers centered in a single document.

## Status
- [ ] Backlog
- [ ] Research: `gif-read-write` or specialized GIF/APNG frame readers.

## Architecture

### Animated GIF Structure
- Multiple Graphic Control Extension (GCE) blocks.
- Individual image descriptors and LZW-compressed data.
- Disposal modes (None, Do Not Dispose, Restore to Background).

### Animated PNG (APNG) Structure
- Sequence Control (fcTL) and Frame Data (fdAT) chunks.
- Blending/Disposal modes.

### Implementation Strategy
1. **Research**: Lightweight libraries that can extract frames into `ImageData`.
2. **GifFormat Adapter (Full)**:
   - `read(buffer)`: Loop through frames.
   - For each frame: Extract pixel data and alpha.
   - Map frames ➡️ HCIE layers.
3. **ApngFormat Adapter**:
   - Similar to GIF, extracting frames into layers.

## Verification Plan

### Manual
- Open an animated `.gif` or `.png` and verify:
  - Each frame appears as a separate layer.
  - Frame order is correct (Layer 1 = Frame 1).

### Risks
- Memory: 100+ frame GIFs will create 100+ layers, causing significant performance lag. Limit import or warn the user.
