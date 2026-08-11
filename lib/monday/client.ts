const MONDAY_API_URL = "https://api.monday.com/v2";

type MondayResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
  }>;
};

export async function mondayRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN;

  if (!token) {
    throw new Error("Falta MONDAY_API_TOKEN");
  }

  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "API-Version": "2026-07",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    cache: "no-store",
  });

  const result = (await response.json()) as MondayResponse<T>;

  if (!response.ok || result.errors?.length || !result.data) {
    const message =
      result.errors?.map((error) => error.message).join(", ") ||
      `Monday respondió con HTTP ${response.status}`;

    throw new Error(message);
  }

  return result.data;
}