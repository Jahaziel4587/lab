import "server-only";
import { listBoxFolderItems, type BoxItem } from "./boxClient";
import { selectBoxSpec } from "./specMatching";

async function allItems(folderId: string) {
  let offset = 0;
  const entries: BoxItem[] = [];
  while (true) {
    const page = await listBoxFolderItems(folderId, offset);
    entries.push(...page.entries);
    offset += page.entries.length;
    if (offset >= page.total_count) return entries;
    if (!page.entries.length) throw new Error("Box devolvió una página incompleta de SPECs. Intenta de nuevo.");
  }
}
const normalize = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const excluded = (name: string) => /editable|ephotocop|e-photocop|obsolet|draft|borrador|histor|superseded|archive/.test(normalize(name));
const isSpecFolder = (name: string) => !excluded(name) && /(?:^|[^a-z])(?:specs?|sepcs?)(?:$|[^a-z])/.test(normalize(name));

export async function getIncomingSpecReference({ source, projectId, wiCode }: { source: "mts" | "project"; projectId?: string; wiCode: string }) {
  let roots: string[];
  if (source === "mts") {
    const folder = process.env.BOX_MTS_SPECS_FOLDER_ID?.trim();
    if (!folder) return { spec: null, reason: "Falta configurar BOX_MTS_SPECS_FOLDER_ID en Vercel para consultar las SPECs de MTS." };
    if (!/^\d+$/.test(folder)) throw new Error("BOX_MTS_SPECS_FOLDER_ID debe ser el ID numérico de la carpeta de Box.");
    roots = [folder];
  } else {
    if (!projectId || !/^\d+$/.test(projectId)) throw new Error("Proyecto inválido.");
    const contents = await allItems(projectId);
    roots = contents.filter(item => item.type === "folder" && isSpecFolder(item.name)).map(item => item.id);
    if (!roots.length) return { spec: null, reason: "No se encontró la carpeta SPECs dentro del DMR del proyecto." };
  }
  const files: BoxItem[] = [];
  const queue = roots.map(id => ({ id, depth: 0 }));
  const visited = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    if (visited.size > 60) throw new Error("La carpeta contiene demasiadas subcarpetas para confirmar la última SPEC. Captura la referencia manualmente.");
    const items = await allItems(current.id);
    files.push(...items.filter(item => item.type === "file" && /\.pdf$/i.test(item.name)));
    const children = items.filter(item => item.type === "folder" && !excluded(item.name));
    if (current.depth >= 4 && children.length) throw new Error("La búsqueda de SPECs no pudo completarse por la profundidad de las carpetas.");
    queue.push(...children.map(item => ({ id: item.id, depth: current.depth + 1 })));
  }
  return selectBoxSpec(wiCode, files);
}
