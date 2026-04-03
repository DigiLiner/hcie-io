/**
 * @file psd-handler.ts
 * @description PSD file read/write using psd.js (read) and ag-psd (write).
 * Migrated from psd_handler.js.
 */
import { LayerClass } from '@hcie/core';
import type { ILayer } from '@hcie/core';
import { LayerData } from './format-interface';
declare global {
    const PSD: {
        new (data: Uint8Array): PSDInstance;
    } | undefined;
    const psd: typeof PSD | undefined;
    const agPsd: {
        readPsd(data: ArrayBuffer | Uint8Array, options?: any): AgPsdData;
        writePsd(data: AgPsdData, options?: any): ArrayBuffer | Uint8Array;
    } | undefined;
    interface Window {
        loadPsdFile: (buffer: ArrayBuffer) => Promise<PSDInstance | null>;
        convertPsdToLayers: (psdObj: PSDInstance) => Promise<LayerClass[]>;
        savePsdFile: (layers: LayerClass[]) => Promise<Uint8Array | null>;
        applyPsdToCanvas?: (psd: PSDInstance) => void;
    }
}
interface PSDNode {
    name?: string;
    width: number;
    height: number;
    left: number;
    top: number;
    visible(): boolean;
    isGroup(): boolean;
    children(): PSDNode[];
    toPng(): HTMLImageElement;
    layer?: {
        opacity?: number;
        blendMode?: {
            blendKey: string;
        };
        image?: {
            pixelData: number[];
        };
    };
}
interface PSDInstance {
    parse(): boolean;
    tree(): {
        width: number;
        height: number;
        children(): PSDNode[];
    };
}
interface AgPsdLayer {
    name: string;
    canvas: HTMLCanvasElement | OffscreenCanvas | ImageData;
    opacity: number;
    hidden: boolean;
    blendMode: string;
    left: number;
    top: number;
}
interface AgPsdData {
    width: number;
    height: number;
    channels: number;
    canvas: HTMLCanvasElement | OffscreenCanvas | ImageData | null;
    children: AgPsdLayer[];
}
export declare function loadPsdFile(arrayBuffer: ArrayBuffer): Promise<PSDInstance | null>;
export declare function convertPsdToLayers(psdObj: any): Promise<LayerClass[]>;
export declare function savePsdFile(layerList: (ILayer | LayerData)[], composite?: ImageData): Promise<Uint8Array | null>;
export {};
