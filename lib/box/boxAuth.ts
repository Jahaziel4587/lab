import "server-only";

type BoxTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

let cachedAccessToken: string | null = null;
let accessTokenExpiresAt = 0;

function getRequiredEnvironmentVariable(
  name: string,
) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Falta ${name} en .env.local`,
    );
  }

  return value;
}

export async function getBoxAccessToken() {
  const now = Date.now();

  if (
    cachedAccessToken &&
    now < accessTokenExpiresAt
  ) {
    return cachedAccessToken;
  }

  const clientId =
    getRequiredEnvironmentVariable(
      "BOX_CLIENT_ID",
    );

  const clientSecret =
    getRequiredEnvironmentVariable(
      "BOX_CLIENT_SECRET",
    );

  const enterpriseId =
    getRequiredEnvironmentVariable(
      "BOX_ENTERPRISE_ID",
    );

  const formData = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    box_subject_type: "enterprise",
    box_subject_id: enterpriseId,
  });

  const response = await fetch(
    "https://api.box.com/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `No se pudo autenticar con Box: ` +
        `${response.status} ${responseText}`,
    );
  }

  const data =
    (await response.json()) as BoxTokenResponse;

  cachedAccessToken = data.access_token;

  accessTokenExpiresAt =
    Date.now() +
    Math.max(data.expires_in - 60, 60) * 1000;

  return cachedAccessToken;
}