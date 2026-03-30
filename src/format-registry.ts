import { IImageFormat } from "./format-interface";

/**
 * Registry class for managing supported image file formats.
 * Provides lookup and filter generation for UI dialogs.
 */
export class FormatRegistry {
  private formats: Map<string, IImageFormat> = new Map();

  /**
   * Registers a new image format handler.
   * If an extension is already registered, the new format will overwrite it.
   */
  register(format: IImageFormat): void {
    format.extensions.forEach((ext) => {
      this.formats.set(ext.toLowerCase(), format);
    });
  }

  /**
   * Retrieves a format handler based on file extension.
   * @param ext The extension including the dot (e.g. ".psd").
   */
  getByExtension(ext: string): IImageFormat | null {
    return this.formats.get(ext.toLowerCase()) || null;
  }

  /**
   * Returns all registered unique format handlers.
   */
  getAll(): IImageFormat[] {
    return Array.from(new Set(this.formats.values()));
  }

  /**
   * Generates a combined filter string for "Open" dialogs.
   * Format: "All Support Image Files|*.png;*.jpg;*.psd|PNG Images|*.png|..."
   */
  getOpenFilter(): string {
    const parts: string[] = [];
    
    // 1. All Image Files (User's specific list from USER_TASKS.md)
    const allList = ".bmp;.cut;.dds;.gif;.ico;.iff;.jpg;.koala;.lbm;.mng;.pbm;.pcd;.pcx;.pgm;.png;.ppm;.psd;.ras;.rle;.tga;.tif;.wbmp;.xbm;.xpm";
    parts.push(`Image Files|*${allList.split(";").join(";*")}`);

    // 2. Specific Groupings from USER_TASKS.md
    parts.push("Bitmaps (.bmp,.dib)|*.bmp;*.dib");
    parts.push("GIF images (*.gif)|*.gif");
    parts.push("JPEG images (*.jpg)|*.jpg");
    parts.push("Windows Metafiles (.wmf,.emf)|*.wmf;*.emf");
    parts.push("Icons (.ico,.cur)|*.ico;*.cur");

    // 3. Application Formats (Krita, GIMP, PSD, Paint.NET)
    parts.push("Photoshop (.psd)|*.psd");
    parts.push("Krita (.kra)|*.kra");
    parts.push("GIMP (.xcf)|*.xcf");
    parts.push("Paint.NET (.pdn)|*.pdn");

    // 4. Fallback All Files
    parts.push("All Files|*.*");
    
    return parts.join("|");
  }

  /**
   * Generates a filter string for "Save" dialogs.
   */
  getSaveFilter(): string {
    const all = this.getAll();
    const parts: string[] = [];

    all
      .filter((f) => f.canWrite)
      .forEach((f) => {
        const pattern = "*" + f.extensions.join(";*");
        parts.push(`${f.name}|${pattern}`);
      });

    return parts.join("|");
  }
}

/**
 * Global singleton instance of the registry.
 */
export const imageFormatRegistry = new FormatRegistry();

// Default registrations (Deferred to avoid circular imports during module load if possible, 
// but since formats only import the interface, this is safe here)
import { PngFormat } from "./formats/png-format";
import { JpegFormat } from "./formats/jpeg-format";
import { PsdFormat } from "./formats/psd-format";
import { BmpFormat } from "./formats/bmp-format";
import { TgaFormat } from "./formats/tga-format";
import { IcoFormat } from "./formats/ico-format";
import { GifFormat } from "./formats/gif-format";
import { WebpFormat } from "./formats/webp-format";
import { KraFormat } from "./formats/kra-format";
import { XcfFormat } from "./formats/xcf-format";
import { PdnFormat } from "./formats/pdn-format";

imageFormatRegistry.register(new PngFormat());
imageFormatRegistry.register(new JpegFormat());
imageFormatRegistry.register(new PsdFormat());
imageFormatRegistry.register(new BmpFormat());
imageFormatRegistry.register(new TgaFormat());
imageFormatRegistry.register(new IcoFormat());
imageFormatRegistry.register(new GifFormat());
imageFormatRegistry.register(new WebpFormat());
imageFormatRegistry.register(new KraFormat());
imageFormatRegistry.register(new XcfFormat());
imageFormatRegistry.register(new PdnFormat());
