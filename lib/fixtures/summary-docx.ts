import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import sharp from "sharp";
import { adminStorage } from "../firebaseAdmin";

// The image module has no TypeScript declarations.
const ImageModule = require("docxtemplater-image-module-free");
type Photo = { data: Buffer; width: number; height: number };

export function descriptionWidths(zip: PizZip): number[] {
  const xml = zip.file("word/document.xml")!.asText();
  return [...xml.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)]
    .filter(([cell]) => [...cell.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("").includes("{%imagen}"))
    .map(([cell]) => {
      const twips = Number(cell.match(/<w:tcW\b[^>]*w:w="(\d+)"/)?.[1]);
      if (!twips) throw new Error("La columna de fotos debe tener un ancho definido.");
      // 15 twips per pixel, with room for cell margins and paragraph indentation.
      return Math.max(1, Math.floor(twips / 15 - 24));
    });
}

export async function versionPhotos(files: any[], pedidoId: string, maxWidth: number): Promise<{ imagen: Photo }[]> {
  const photos: { imagen: Photo }[] = [];
  for (const file of files || []) {
    if (!/\.(png|jpe?g|webp|gif|tiff?|heic|heif|avif|bmp)$/i.test(file.name || "")) continue;
    const url = new URL(file.url);
    if (url.hostname !== "firebasestorage.googleapis.com") throw new Error(`Origen de foto no válido: ${file.name}`);
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    const bucket = adminStorage.bucket();
    const objectPath = match ? decodeURIComponent(match[2]) : "";
    if (!match || decodeURIComponent(match[1]) !== bucket.name || !objectPath.startsWith(`pedidos/${pedidoId}/fixturing/`)) {
      throw new Error(`La foto no pertenece a este fixture: ${file.name}`);
    }
    const object = bucket.file(objectPath);
    const [metadata] = await object.getMetadata();
    if (Number(metadata.size) > 20 * 1024 * 1024) throw new Error(`La foto supera 20 MB: ${file.name}`);
    const [source] = await object.download();
    const { data, info } = await sharp(source, { limitInputPixels: 40000000 }).rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
    const scale = Math.min(1, maxWidth / info.width, 240 / info.height);
    photos.push({ imagen: { data, width: Math.max(1, Math.floor(info.width * scale)), height: Math.max(1, Math.floor(info.height * scale)) } });
  }
  return photos;
}

export function renderSummary(zip: PizZip, data: Record<string, unknown>) {
  // Rows must grow naturally when a version contains several photos.
  zip.file("word/document.xml", zip.file("word/document.xml")!.asText()
    .replace(/<w:trHeight\b[^>]*\/>/g, "")
    .replace(/<w:cantSplit\b[^>]*\/>/g, ""));
  const photos = new Map<string, Photo>();
  const prepare = (value: any): any => {
    if (Array.isArray(value)) return value.map(prepare);
    if (value && typeof value === "object") {
      if (value.imagen?.data) {
        const key = `fixture-photo-${photos.size}`;
        photos.set(key, value.imagen);
        return { ...value, imagen: key };
      }
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, prepare(item)]));
    }
    return value;
  };
  const prepared = prepare(data);
  const images = new ImageModule({ centered: false,
    getImage: (key: string) => photos.get(key)!.data,
    getSize: (_buffer: Buffer, key: string) => [photos.get(key)!.width, photos.get(key)!.height],
  });
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, modules: [images], nullGetter: () => "" });
  doc.render(prepared);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
