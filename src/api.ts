/**
 * @file api.ts
 * @description Platform-aware file API bridge.
 * Detects Tauri, Electron, or Web environment and provides a unified interface.
 * Migrated from renderer.js.
 */

import type { AppFileAPI } from '@hcie/core';
import { imageFormatRegistry } from './format-registry';

// ─── Tauri type shims (populated via withGlobalTauri) ──────
declare global {
  interface Window {
    __TAURI__?: {
      dialog: {
        open(opts: { filters: { name: string; extensions: string[] }[] }): Promise<string | string[] | null>;
        save(opts: { filters: { name: string; extensions: string[] }[]; defaultPath?: string }): Promise<string | null>;
      };
      fs: {
        readTextFile(path: string): Promise<string>;
        readFile(path: string): Promise<Uint8Array>;
        writeTextFile(path: string, content: string): Promise<void>;
        writeFile(path: string, content: Uint8Array): Promise<void>;
      };
    };
    electronAPI?: AppFileAPI;
    lastSelectedFile?: File;
    lastFileName?: string;
    api: AppFileAPI;
  }
}

// ─── API Factory ───────────────────────────────────────────

function buildTauriApi(): AppFileAPI {
  const { open, save } = window.__TAURI__!.dialog;
  const { readTextFile, readFile, writeTextFile, writeFile } = window.__TAURI__!.fs;

  return {
    openFile: async (): Promise<string | null> => {
      // Use dynamic filters from the registry
      const rawFilter = imageFormatRegistry.getOpenFilter();
      // Tauri requires an array of objects for filters
      const tauriFilters = rawFilter.split("|").reduce((acc: { name: string; extensions: string[] }[], curr: string, i: number, arr: string[]) => {
          if (i % 2 === 0) {
              const extensions = arr[i+1].replace(/\*\./g, "").split(";");
              acc.push({ name: curr, extensions });
          }
          return acc;
      }, []);

      // Always include HCIE Project
      tauriFilters.push({ name: 'HCIE Project', extensions: ['hcie'] });

      const result = await open({
        filters: tauriFilters
      });
      if (Array.isArray(result)) return result[0] ?? null;
      return result;
    },

    readFile: async (filePath: string): Promise<string | null> =>
      readTextFile(filePath),

    readFileBinary: async (filePath: string): Promise<Uint8Array | null> =>
      readFile(filePath),

    saveFile: async (
      content: string | Uint8Array | ArrayBuffer,
      filePath: string | null,
      saveas: boolean,
      type: 'png' | 'jpg' | 'psd' | 'hcie' | 'gif'
    ): Promise<string | null> => {
      try {
        let filters: { name: string; extensions: string[] }[] = [];
        if (type === 'hcie') {
            filters = [{ name: 'HC Image Editor Project', extensions: ['hcie'] }];
        } else {
            const format = imageFormatRegistry.getByExtension("." + type);
            if (format) {
                filters = [{ name: format.name, extensions: format.extensions.map((e: string) => e.replace(".", "")) }];
            } else {
                filters = [{ name: 'Image', extensions: [type] }];
            }
        }

        let targetPath = filePath;
        if (saveas || !filePath) {
          const ext = type;
          targetPath = await save({ filters, defaultPath: filePath ?? `untitled.${ext}` });
          if (!targetPath) return null;
        }
        if (!targetPath) return null;

        // Auto-append extension if missing
        const expectedExt = `.${type === 'hcie' ? 'hcie' : type === 'psd' ? 'psd' : type === 'jpg' ? 'jpg' : type === 'gif' ? 'gif' : 'png'}`;
        if (!targetPath.toLowerCase().endsWith(expectedExt)) {
            // Check if it already has another valid extension from the same type (like .jpeg for jpg)
            const isJpeg = type === 'jpg' && targetPath.toLowerCase().endsWith('.jpeg');
            if (!isJpeg) {
                targetPath += expectedExt;
            }
        }

        if (type === 'hcie') {
          await writeTextFile(targetPath, content as string);
        } else {
          let bytes: Uint8Array;
          if (typeof content === 'string' && content.startsWith('data:')) {
            const base64 = content.replace(/^data:image\/\w+;base64,/, '');
            const binary = atob(base64);
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          } else if (content instanceof Uint8Array) {
            bytes = content;
          } else if (content instanceof ArrayBuffer) {
            bytes = new Uint8Array(content);
          } else {
            // If it's a string (e.g. project JSON), convert to bytes
            const encoder = new TextEncoder();
            bytes = encoder.encode(content as string);
          }
          console.log(`[Tauri] Writing ${bytes.length} bytes to ${targetPath}`);
          await writeFile(targetPath, bytes);
        }
        return targetPath;
      } catch (err) {
        console.error('[Tauri] saveFile failed:', err);
        alert(`Tauri Save Error: ${(err as Error).message}\nPath: ${filePath}`);
        throw err;
      }
    },

    onMenuOpen: () => { /* Tauri menu events wired via main.ts */ },
    onMenuSave: () => { },
    onMenuSaveAs: () => { },
    onMenuExport: () => { },
    onMenuErodeBorder: () => { },
    onMenuFadeBorder: () => { },
    isDesktop: true
  };
}

function buildWebFallbackApi(): AppFileAPI {
  return {
    openFile: (): Promise<string | null> =>
      new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.hcie,' + imageFormatRegistry.getAll().map((f: any) => f.extensions.join(",")).join(",");
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) { resolve(null); return; }
          window.lastSelectedFile = file;
          if (file.name) {
            window.lastFileName = file.name;
            resolve(file.name);
          }
        };
        input.click();
      }),

    readFile: async (_filePath: string): Promise<string | null> => {
      const file = window.lastSelectedFile;
      if (!file) { console.error('No file selected in Web Mode'); return null; }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
    },

    readFileBinary: async (_filePath: string): Promise<Uint8Array | null> => {
      const file = window.lastSelectedFile;
      if (!file) return null;
      const buf = await file.arrayBuffer();
      return new Uint8Array(buf);
    },

    saveFile: async (
      content: string | Uint8Array | ArrayBuffer,
      filePath: string | null,
      saveas: boolean,
      type: 'png' | 'jpg' | 'psd' | 'hcie' | 'gif'
    ): Promise<string | null> => {
      // 1. Modern Web Save (File System Access API)
      if (typeof (window as any).showSaveFilePicker === 'function' && !saveas && (window as any).lastFileHandle) {
        try {
          const handle = (window as any).lastFileHandle;
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          return handle.name;
        } catch (e) {
          console.warn('FSAA failed, falling back to download:', e);
        }
      }

      // 2. New Modern Save As (to get a handle for future saves)
      if (typeof (window as any).showSaveFilePicker === 'function' && (saveas || !(window as any).lastFileHandle)) {
        try {
          const opts = {
            suggestedName: filePath || `untitled.${type}`,
            types: [{
              description: `${type.toUpperCase()} File`,
              accept: { [type === 'hcie' ? 'application/json' : `image/${type}`]: [`.${type}`] }
            }]
          };
          const handle = await (window as any).showSaveFilePicker(opts);
          (window as any).lastFileHandle = handle;
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          return handle.name;
        } catch (e) {
          console.warn('FSAA Save As failed or cancelled:', e);
        }
      }

      // 3. Traditional download fallback
      const a = document.createElement('a');
      let url: string;

      if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
        const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
        const mimeMap: any = { psd: 'image/vnd.adobe.photoshop', hcie: 'application/json', png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif' };
        const blob = new Blob([bytes as unknown as BlobPart], { type: mimeMap[type] ?? 'application/octet-stream' });
        url = URL.createObjectURL(blob);
      } else if (typeof content === 'string' && !content.startsWith('data:')) {
        const blob = new Blob([content], { type: 'application/json' });
        url = URL.createObjectURL(blob);
      } else {
        url = content as string;
      }

      let name = filePath ?? 'untitled';
      if (!name.includes('.')) name += `.${type}`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
      return name;
    },

    onMenuOpen: () => { },
    onMenuSave: () => { },
    onMenuSaveAs: () => { },
    onMenuExport: () => { },
    isDesktop: false
  };
}

// ─── Resolve Api ───────────────────────────────────────────

function resolveApi(): AppFileAPI {
  if (window.__TAURI__) {
    console.log('Tauri API found. Initializing Tauri Mode.');
    const tauriApi = buildTauriApi();
    (tauriApi as any).isDesktop = true;
    return tauriApi as AppFileAPI;
  }
  if (window.electronAPI) {
    console.log('Electron API successfully linked.');
    const elApi = window.electronAPI;
    (elApi as any).isDesktop = true;
    return elApi;
  }
  console.warn('Desktop API not found. Using Web Mode Fallback.');
  return buildWebFallbackApi();
}

export const api: AppFileAPI = resolveApi();
// Expose for legacy global calls
window.api = api;
