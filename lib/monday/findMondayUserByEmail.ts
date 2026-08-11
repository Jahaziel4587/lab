import { mondayRequest } from "./client";

type MondayUser = {
  id: string;
  name: string;
  email: string;
};

type UsersResponse = {
  users: MondayUser[];
};

export async function findMondayUserByEmail(
  email: string,
): Promise<MondayUser | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const query = `
    query FindMondayUser($emails: [String!]!) {
      users(emails: $emails) {
        id
        name
        email
      }
    }
  `;

  const result = await mondayRequest<UsersResponse>(query, {
    emails: [normalizedEmail],
  });

  const user = result.users.find(
    (candidate) =>
      candidate.email.trim().toLowerCase() === normalizedEmail,
  );

  return user ?? null;
}