/**
 * @file comparison.ts
 * @description Test image comparison script for Krita format validation
 */

import { KritaTiles } from '../formats/krita-tiles';
import { PNG } from '../formats/png';

async function compareTestImages(): Promise<void> {
  console.log('=== Krita Format Test Images Comparison ===\n');

  // Test images
  const originalPng = new Uint8Array(
    await fetch('file://' + import.meta.url.replace('file://', '') + '/../../io-format-tests/color_test_original.png')
  ).arrayBuffer();

  const kritaDebug = new Uint8Array(
    await fetch('file://' + import.meta.url.replace('file://', '') + '/../../io-format-tests/krita-debug_test-image-saved-by-krita.kra')
  ).arrayBuffer();

  console.log('[Test] Loading original PNG...');
  const originalImage = await PNG.decode(originalPng);
  
  console.log('[Test] Loading KRA file...');
  const kritaImage = KritaTiles.parse(
    kritaDebug,
    originalImage.width,
    originalImage.height
  );

  console.log('[Test] Original dimensions:', originalImage.width, 'x', originalImage.height);
  console.log('[Test] Krita dimensions:', kritaImage.width, 'x', kritaImage.height);

  // Save comparison results
  await PNG.encode({
    data: kritaImage,
    width: originalImage.width,
    height: originalImage.height,
  });

  console.log('[Test] Comparison complete! Results saved.');
}

// Run test
comparisonTestImages().catch(console.error);
