import { BlendMode } from '@hcie/shared';

export interface ILayer {
    name: string;
    visible: boolean;
    opacity: number;
    blendMode: BlendMode;
    locked: boolean;
    canvas: HTMLCanvasElement | OffscreenCanvas;
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    width: number;
    height: number;
    x?: number;
    y?: number;
    type: 'raster' | 'vector' | 'text';
    shapes?: any[];
    textData?: any;
}

export class LayerClass implements ILayer {
    name: string;
    visible: boolean = true;
    opacity: number = 1.0;
    blendMode: BlendMode = 'source-over';
    locked: boolean = false;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | null;
    width: number;
    height: number;
    x: number = 0;
    y: number = 0;
    type: 'raster' | 'vector' | 'text' = 'raster';
    
    constructor(name: string, width: number, height: number) {
        this.name = name;
        this.width = width;
        this.height = height;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
    }
}

export const g = {
    image_width: 800,
    image_height: 600,
    image_bg_color: '#ffffff',
    activeLayerIndex: 0,
    initDefaultLayer: () => {
        layers.length = 0;
        layers.push(new LayerClass("Background", g.image_width, g.image_height));
    }
};

export const layers: ILayer[] = [];

export function newDocument(name: string, w: number, h: number): void {
    console.log(`[MOCK-CORE] New Document: ${name} (${w}x${h})`);
    g.image_width = w;
    g.image_height = h;
    layers.length = 0;
}

export type { BlendMode };
export interface TextData {
    text: string;
    x: number;
    y: number;
    font: string;
    size: number;
    color: string;
    bold: boolean;
    italic: boolean;
}
