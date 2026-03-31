export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity' | 'source-over';
export type LayerType = 'raster' | 'vector' | 'text';

export interface Shape {
    type: 'rect' | 'circle' | 'line' | 'pencil';
    points: { x: number, y: number }[];
    strokeColor: string;
    strokeWidth: number;
    fillColor?: string;
}
