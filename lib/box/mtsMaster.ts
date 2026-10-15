import "server-only";
import { getBoxAccessToken } from "./boxAuth";
import { parseMtsMaster } from "@/lib/production/mts-master";

export async function getMtsMasterCatalog() {
  const fileId = process.env.BOX_MTS_MASTER_FILE_ID?.trim();
  if (!fileId || !/^\d+$/.test(fileId)) throw new Error("Configura BOX_MTS_MASTER_FILE_ID con el ID del Excel maestro MTS de Box.");
  const token = await getBoxAccessToken();
  const response = await fetch(`https://api.box.com/2.0/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(30000),
  });
  if (response.status === 202) throw new Error("Box está preparando la lista maestra MTS. Intenta actualizar nuevamente.");
  if (!response.ok) throw new Error(`No se pudo leer la lista maestra MTS de Box (${response.status}). Verifica el ID del archivo y el acceso de la integración.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) throw new Error("La lista maestra MTS supera el tamaño permitido (10 MB).");
  return parseMtsMaster(buffer);
}
