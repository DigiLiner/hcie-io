# Plan #1055 & #1056 – Specialized Raster and Vector Support

## Goal
Implement a generic or specialized fallback for the remaining image formats, and add vector support where possible.

## Status
- [ ] Backlog: TIF, PCX, DDS, etc.
- [ ] Backlog: WMF, EMF, SVG.

## Architecture

### Specialized Raster Support (#1055)
Extensions: `.cut;.dds;.iff;.koala;.lbm;.mng;.pbm;.pcd;.pcx;.pgm;.ppm;.ras;.rle;.tif;.wbmp;.xbm;.xpm`
- **TIF (Tagged Image Format)**: High priority due to widespread use in photography.
- **DDS (DirectDraw Surface)**: Used in game textures.
- **Implementation Strategy**:
  1. Identify unique features (e.g., TIF multi-page support).
  2. Implement TifFormat and other adapters as needed.

### Vector & Metafile Support (#1056)
- **SVG (Scalable Vector Graphics)**: Import as a raster layer (rendered at full resolution) or SVG path data.
- **WMF/EMF (Windows Metafile)**: Legacy Windows format support.
- **Implementation Strategy**:
  1. Use browser-native SVG rendering for base SVG import.
  2. Research lightweight WMF/EMF parsers for legacy support.

## Verification Plan

### Manual
- Open `.tif` and `.svg` files and verify:
  - Rendering quality and alpha transparency.

### Risks
- Many specialized formats are legacy and have fragmented specifications. Support will be provided on a best-effort basis.
