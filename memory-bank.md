# Project Memory Bank: Format Converter Library (TypeScript)

## Project Overview
TypeScript tabanlı görsel dosya işleme ve dönüştürme kütüphanesi. PSD, KRA, XCF gibi katmanlı formatları ve standart raster formatlarını HCIE standartlarına uygun şekilde okur ve dönüştürür.

## Architecture
- **Core**: `index.ts` (Entry), `api.ts` (High-level API), `format-registry.ts` (Routing).
- **Format Infrastructure**: `format-interface.ts` (`DecodedImage` structure).
- **Format Handlers**: `src/formats/` altında her format için özel modüller.

## Implementation Details
### Krita (.kra) Support
- **Parser**: `krita-tiles.ts` üzerinden Krita V2 Tiled Binary formatı işlenir.
- **Features**: LZF dekompresyonu, Planar Horizontal Delta çözme.
- **Coordinate System**: Tiled veriler absolute origin (0,0) kullanır.

### Standard Formats
- PSD, PNG, JPEG, BMP desteği sabittir.
- TGA, ICO, WebP, GIF (Single frame) desteği mevcuttur.

## Pending Tasks (Critical)
1. **Test UI (index.html)**: `io-format-tests` klasöründeki test resimlerini özel test butonları ile yükleme işlevini ekleme.
2. **Krita Debugging**: Tiled çıktıdaki bozulmaları tamamen gidermek için binary parser optimizasyonu.
3. **GIMP (.xcf)**: RLE sıkıştırmalı binary parsing desteği.
4. **Animated Extraction**: GIF ve APNG karelerini katman olarak okuma.

## AI Operational Rules
- Büyük mimari değişikliklerde bu dosyayı güncelle.
- Yeni format eklendiğinde `format-registry.ts` kaydını unutma.
- Gereksiz implementasyon detaylarını burada saklama, sadece stratejik bilgileri tut.