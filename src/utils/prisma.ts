import crypto from "node:crypto";
import { PrismaClient } from "../prisma-generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prismaClient = new PrismaClient({ adapter });

export function hashPassword(password: string) {
  return new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, "salt", 100000, 64, "sha256", (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey.toString("hex"));
      }
    });
  });
}
