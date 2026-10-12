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
    const responseText =
      await response.text();

    throw new Error(
      `Box respondió ${response.status}: ` +
        responseText,
    );
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
  file_version?: { id: string };
  path_collection: { entries: Array<{ id: string; name: string }> };
};

export async function getBoxFileDetails(fileId: string) {
  return boxRequest<BoxFileDetails>(`/files/${fileId}?fields=id,type,name,size,file_version,path_collection`);
}

export async function downloadBoxPdf(fileId: string, versionId: string) {
  const token = await getBoxAccessToken();
  const response = await fetch(
    `${BOX_API_URL}/files/${fileId}/content?version=${encodeURIComponent(versionId)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(60000) },
  );
  if (!response.ok || !response.body) throw new Error("No se pudo descargar el PDF de Box.");
  return response;
}
