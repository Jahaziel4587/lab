import "server-only";
import { listAllBoxFolderItems } from "./boxClient";

export type DhrPdf = { id: string; name: string; path: string; queries: string[] };
export function normalizeDhrName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\.pdf$/i, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function requireDmrProject(projectId: string) {
  const root = process.env.BOX_DMR_FOLDER_ID;
  if (!root) throw new Error("Falta configurar la carpeta DMR de Box.");
  const projects = await listAllBoxFolderItems(root);
  const project = projects.find(item => item.type === "folder" && item.id === projectId && /^DMR\.\d+/i.test(item.name.trim()));
  if (!project) throw new Error("El proyecto no pertenece al catálogo DMR autorizado.");
  return project;
}

export async function searchDmrPdfs(projectId: string, queries: string[]) {
  const project = await requireDmrProject(projectId);
  const queue = [{ id: project.id, path: project.name }];
  const visited = new Set<string>();
  const files: DhrPdf[] = [];
  const started = Date.now();
  while (queue.length) {
    if (Date.now() - started > 220000 || visited.size > 2000) {
      throw new Error("El DMR es demasiado grande para completar esta búsqueda. No se muestran resultados parciales.");
    }
    const folder = queue.shift()!;
    if (visited.has(folder.id)) continue;
    visited.add(folder.id);
    const entries = await listAllBoxFolderItems(folder.id);
    for (const item of entries) {
      if (item.type === "folder") queue.push({ id: item.id, path: `${folder.path}/${item.name}` });
      if (item.type !== "file" || !/\.pdf$/i.test(item.name)) continue;
      const name = normalizeDhrName(item.name);
      const matches = queries.filter(query => name.includes(normalizeDhrName(query)));
      if (matches.length) files.push({ id: item.id, name: item.name, path: folder.path, queries: matches });
    }
  }
  return { files, missing: queries.filter(query => !files.some(file => file.queries.includes(query))) };
}
