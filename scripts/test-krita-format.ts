/**
 * @file test-krita-format.ts
 * @description Test script for Krita format parsing
 */

import { KritaTiles } from '../src/formats/krita-tiles';
import { PNG } from "../src/formats/png-format";
import * as fs from 'fs'; // Use import instead of require

// Load test files
function loadTestFiles() {
  try {
    const kraBuffer = fs.readFileSync('io-format-tests/krita-debug_test-image-saved-by-krita.kra');
    const originalPng = fs.readFileSync('io-format-tests/color_test_original.png');
    
    return {
      kraBuffer: new Uint8Array(kraBuffer),
      originalPng: new Uint8Array(originalPng)
    };
  } catch (err) {
    console.error('Error loading test files:', err);
    return null;
  }
}

// Main test function
async function runTest() {
  const files = loadTestFiles();
  if (!files) return;

  console.log('=== Krita Format Test ===\n');
  
  // Parse Krita file
  const imageWidth = 100;
  const imageHeight = 100;
  const kraImage = KritaTiles.parse(files.kraBuffer, imageWidth, imageHeight);

  // Create test PNG from parsed data
  const testPng = await PNG.encode({
    data: kraImage,
    width: imageWidth,
    height: imageHeight,
  });

  console.log('Test completed!');
}

runTest().catch(console.error);
