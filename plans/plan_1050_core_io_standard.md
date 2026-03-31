# Plan #1050 – Core I/O & Standard Raster Formats [RESUMED]

## Goal
Standardize and verify the core I/O architecture and basic raster/application format support. Focus on remaining verification and fixes.

## Remaining Status
- [ ] Phase 2: TGA, ICO, WebP, GIF (Need verification)
- [🔴] Phase 3: KRA, XCF, PDN (Implementation issues - Critical fix needed for Krita)

## Current Tasks
- [ ] **Krita Fix**: Debug and fix `krita-tiles.ts` (currently producing scrambled output).
- [ ] **GIMP Support**: Debug and fix `xcf-format.ts`.
- [ ] **Verification**: Run functionality tests for TGA, ICO, WebP, and GIF.
- [ ] **Unit Tests**: Add unit tests for all formats to prevent regressions.

## Verification Plan
- **Krita**: Open `io-format-tests/krita-debug_test-image-saved-by-krita.kra`.
- **General**: `npm run test:io` (Fix/Implement).
