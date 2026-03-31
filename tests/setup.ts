import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.DOMParser = dom.window.DOMParser;
global.Blob = dom.window.Blob;

class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(dataOrWidth: Uint8ClampedArray | number, width: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = width;
      this.height = height!;
    }
  }
}

global.ImageData = MockImageData as any;

// Polyfill browser globals that JSDOM or Node might be missing but our code uses
if (typeof DecompressionStream !== 'undefined') {
  (global as any).window.DecompressionStream = DecompressionStream;
}

if (typeof Response !== 'undefined') {
  (global as any).window.Response = Response;
}

if (typeof Blob !== 'undefined') {
  (global as any).window.Blob = Blob;
}
