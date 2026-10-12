import "server-only";
import { getBoxAccessToken } from "./boxAuth";

const BOX_API_URL =
  "https://api.box.com/2.0";

export type BoxItem = {
  id: string;
  type: "file" | "folder" | "web_link";
  name: string;
  extension?: string;
};

type BoxFolderItemsResponse = {
  entries: BoxItem[];
  limit: number;
  offset: number;
  total_count: number;
};

type BoxCurrentUser = {
  id: string;
  type: "user";
  name: string;
  login: string;
};

export class BoxDownloadError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function boxFailure(response: Response): Promise<BoxDownloadError> {
  const data = await response.json().catch(() => ({}));
  const code = typeof data.code === "string" ? data.code.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80) : "download_failed";
  const detail = response.status === 403
    ? "Box no permite descargar este archivo con la cuenta de integración. Revisa su rol y las restricciones de descarga."
    : response.status === 404 ? "Box no encontró el archivo o la versión solicitada."
    : response.status === 401 ? "Box rechazó la autenticación de la integración."
    : `Box no pudo completar la descarga (HTTP ${response.status}).`;
  return new BoxDownloadError(response.status, code, `${detail} Código: ${code}.`);
}

async function boxRequest<T>(
  path: string,
): Promise<T> {
  const accessToken =
    await getBoxAccessToken();

  const response = await fetch(
    `${BOX_API_URL}${path}`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!response.ok) {
    throw await boxFailure(response);
  }

  return response.json() as Promise<T>;
}

export async function getBoxCurrentUser() {
  return boxRequest<BoxCurrentUser>(
    "/users/me?fields=id,name,login",
  );
}

export async function listBoxFolderItems(
  folderId: string,
) {
  return boxRequest<BoxFolderItemsResponse>(
    `/folders/${folderId}/items` +
      "?limit=1000&fields=id,type,name,extension",
  );
}
export async function listAllBoxFolderItems(folderId: string) {
  const entries: BoxItem[] = [];
  let offset = 0;
  while (true) {
    const page = await boxRequest<BoxFolderItemsResponse>(
      `/folders/${folderId}/items?limit=1000&offset=${offset}&fields=id,type,name,extension`,
    );
    entries.push(...page.entries);
    offset += page.entries.length;
    if (offset >= page.total_count) return entries;
    if (!page.entries.length) throw new Error("Box devolvió un listado incompleto.");
  }
}

export type BoxFileDetails = BoxItem & {
  size: number;
  permissions?: { can_download?: boolean };
  file_version?: { id: string };
  path_collection: { entries: Array<{ id: string; name: string }> };
};

export async function getBoxFileDetails(fileId: string) {
  return boxRequest<BoxFileDetails>(`/files/${fileId}?fields=id,type,name,size,file_version,path_collection,permissions`);
}

export async function downloadBoxPdf(fileId: string, versionId: string) {
  const token = await getBoxAccessToken();
  const apiUrl = `${BOX_API_URL}/files/${fileId}/content?version=${encodeURIComponent(versionId)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    let response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` }, redirect: "manual",
      cache: "no-store", signal: AbortSignal.timeout(60000),
    });
    if ([202, 429, 503].includes(response.status)) {
      const seconds = Number(response.headers.get("retry-after") ?? "2");
      await response.body?.cancel();
      if (attempt === 3 || !Number.isFinite(seconds) || seconds > 20) {
        throw new BoxDownloadError(response.status, "retry_later", "Box todavía no tiene disponible la descarga. Vuelve a intentar en unos momentos.");
      }
      await new Promise(resolve => setTimeout(resolve, Math.max(1, seconds) * 1000));
      continue;
    }
    // Box returns a signed URL. Do not forward the API bearer token to its CDN.
    for (let redirects = 0; [301, 302, 303, 307, 308].includes(response.status) && redirects < 5; redirects++) {
      const location = response.headers.get("location");
      if (!location) throw new BoxDownloadError(502, "missing_location", "Box no devolvió el enlace de descarga.");
      const url = new URL(location, apiUrl);
      if (url.protocol !== "https:" || !(url.hostname === "boxcloud.com" || url.hostname.endsWith(".boxcloud.com") || url.hostname === "box.com" || url.hostname.endsWith(".box.com"))) {
        throw new BoxDownloadError(502, "invalid_location", "Box devolvió un enlace de descarga no reconocido.");
      }
      await response.body?.cancel();
      response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(60000) });
    }
    if (response.status !== 200 || !response.body) throw await boxFailure(response);
    return response;
  }
  throw new BoxDownloadError(502, "download_failed", "No se pudo completar la descarga de Box.");
}
