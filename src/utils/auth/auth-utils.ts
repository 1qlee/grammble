import { adjectives, uniqueUsernameGenerator } from "unique-username-generator";
import { animals } from "./data/animals";
import { prismaClient } from "../db/prisma";

export function trimUsername(username: string) {
  // Allow only a-z, A-Z, period (.), dash (-), and underscore (_)
  return username.replace(/[^a-zA-Z._-]/g, "");
}

export function doesUsernameExist(username: string) {
  return prismaClient.user.findUnique({
    where: { username },
    select: { id: true },
  });
}

export async function generateUsername(username?: string) {
  let exists = true;

  // If a username is provided, check if it exists
  if (username) {
    const trimmedUsername = trimUsername(username);

    const usernameExists = await doesUsernameExist(trimmedUsername);

    if (!usernameExists) {
      return { username: trimmedUsername, displayUsername: trimmedUsername };
    }
  }

  // If no username is provided, generate a random one
  while (exists) {
    username = uniqueUsernameGenerator({
      dictionaries: [adjectives, animals],
      style: "pascalCase",
    });

    const existing = await doesUsernameExist(username);

    exists = existing !== null;
  }

  return {
    username: username!.toLowerCase(),
    displayUsername: username!,
  };
}
