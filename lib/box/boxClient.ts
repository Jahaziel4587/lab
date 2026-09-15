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